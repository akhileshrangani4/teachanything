/**
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { readUIMessageStream, type UIMessage } from "ai";

const logWarn = jest.fn();
jest.unstable_mockModule("@/lib/logger", () => ({ logWarn }));

const { guardTextSequence } = await import("@/server/chat/text-sequence-guard");
const { recoverLeakedQuiz } = await import("@/server/chat/recover-quiz");

type Chunk = Record<string, unknown>;

function streamOf(chunks: Chunk[]): ReadableStream<Chunk> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Chunk>): Promise<Chunk[]> {
  const out: Chunk[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out;
    out.push(value);
  }
}

function guarded(chunks: Chunk[]): ReadableStream<Chunk> {
  return streamOf(chunks).pipeThrough(
    guardTextSequence({ chatbotId: "bot" }) as never,
  );
}

/**
 * Assemble the chunks the way the SDK does for the response message.
 * `terminateOnError` surfaces the "missing text part" throw instead of
 * swallowing it.
 */
async function assemble(
  stream: ReadableStream<Chunk>,
): Promise<UIMessage | undefined> {
  let message: UIMessage | undefined;
  for await (const m of readUIMessageStream({
    stream: stream as never,
    terminateOnError: true,
  })) {
    message = m;
  }
  return message;
}

function step(...chunks: Chunk[]): Chunk[] {
  return [{ type: "start-step" }, ...chunks, { type: "finish-step" }];
}

function textOf(message: UIMessage | undefined): string[] {
  return (message?.parts ?? []).flatMap((p) =>
    p.type === "text" ? [p.text] : [],
  );
}

describe("guardTextSequence", () => {
  beforeEach(() => logWarn.mockClear());

  it("passes a well-formed stream through untouched", async () => {
    const chunks = [
      { type: "start" },
      ...step(
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", delta: "Hi" },
        { type: "text-end", id: "t1" },
      ),
      { type: "finish" },
    ];
    expect(await collect(guarded(chunks))).toEqual(chunks);
    expect(logWarn).not.toHaveBeenCalled();
  });

  it("drops a second text-end for the same part", async () => {
    const chunks = [
      { type: "start" },
      ...step(
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", delta: "Searching." },
        { type: "text-end", id: "t1" },
        { type: "text-end", id: "t1" },
      ),
      { type: "finish" },
    ];
    await expect(assemble(streamOf(chunks))).rejects.toThrow(
      /text-end for missing text part/,
    );
    expect(textOf(await assemble(guarded(chunks)))).toEqual(["Searching."]);
    expect(logWarn).toHaveBeenCalledTimes(1);
  });

  it("drops a text-end that arrives after its step finished", async () => {
    const chunks = [
      { type: "start" },
      { type: "start-step" },
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: "Searching." },
      { type: "finish-step" },
      { type: "text-end", id: "t1" },
      ...step(
        { type: "text-start", id: "t2" },
        { type: "text-delta", id: "t2", delta: "The answer." },
        { type: "text-end", id: "t2" },
      ),
      { type: "finish" },
    ];
    await expect(assemble(streamOf(chunks))).rejects.toThrow(
      /text-end for missing text part/,
    );
    const message = await assemble(guarded(chunks));
    expect(textOf(message)).toEqual(["Searching.", "The answer."]);
  });

  it("opens a part for a text-delta that never had a start", async () => {
    const chunks = [
      { type: "start" },
      ...step(
        { type: "text-delta", id: "t1", delta: "Orphan" },
        { type: "text-end", id: "t1" },
      ),
      { type: "finish" },
    ];
    await expect(assemble(streamOf(chunks))).rejects.toThrow(
      /text-delta for missing text part/,
    );
    expect(textOf(await assemble(guarded(chunks)))).toEqual(["Orphan"]);
    expect(logWarn).toHaveBeenCalledTimes(1);
  });

  it("closes a part that is opened again before it ended", async () => {
    const chunks = [
      { type: "start" },
      ...step(
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", delta: "First" },
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", delta: "Second" },
        { type: "text-end", id: "t1" },
      ),
      { type: "finish" },
    ];
    const message = await assemble(guarded(chunks));
    expect(
      message?.parts.flatMap((p) => (p.type === "text" ? [p.state] : [])),
    ).toEqual(["done", "done"]);
    expect(logWarn).toHaveBeenCalledTimes(1);
  });
});

/**
 * DeepSeek V3.2 via OpenRouter starts a tool call while its text block is still
 * open and sends that block's `text-end` only after the call. By then
 * `recoverLeakedQuiz` has closed the block on the tool chunk, so the late
 * `text-end` is orphaned. These run both transforms in pipeline order.
 */
describe("a text block the provider ends after a tool call", () => {
  beforeEach(() => logWarn.mockClear());

  const searchCall: Chunk[] = [
    {
      type: "tool-input-start",
      toolCallId: "c1",
      toolName: "search_documents",
    },
    {
      type: "tool-input-available",
      toolCallId: "c1",
      toolName: "search_documents",
      input: { query: "unit of analysis" },
    },
  ];

  function pipeline(chunks: Chunk[]): ReadableStream<Chunk> {
    return streamOf(chunks)
      .pipeThrough(recoverLeakedQuiz() as never)
      .pipeThrough(guardTextSequence({ chatbotId: "bot" }) as never);
  }

  it("crashes the turn without the guard", async () => {
    const chunks = [
      { type: "start" },
      ...step(
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", delta: "Searching." },
        ...searchCall,
        { type: "text-end", id: "t1" },
      ),
      { type: "finish" },
    ];
    await expect(
      assemble(streamOf(chunks).pipeThrough(recoverLeakedQuiz() as never)),
    ).rejects.toThrow(/text-end for missing text part/);
  });

  it("drops the late text-end and carries on to the answer", async () => {
    const message = await assemble(
      pipeline([
        { type: "start" },
        ...step(
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "Searching." },
          ...searchCall,
          { type: "text-end", id: "t1" },
        ),
        ...step(
          { type: "text-start", id: "t2" },
          { type: "text-delta", id: "t2", delta: "The unit of analysis is..." },
          { type: "text-end", id: "t2" },
        ),
        { type: "finish" },
      ]),
    );
    expect(textOf(message)).toEqual([
      "Searching.",
      "The unit of analysis is...",
    ]);
    expect(logWarn).toHaveBeenCalledTimes(1);
  });

  it("keeps text the provider sends after the tool call", async () => {
    const message = await assemble(
      pipeline([
        { type: "start" },
        ...step(
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "Searching." },
          ...searchCall,
          { type: "text-delta", id: "t1", delta: " More." },
          { type: "text-end", id: "t1" },
        ),
        { type: "finish" },
      ]),
    );
    expect(textOf(message)).toEqual(["Searching.", " More."]);
  });
});
