import { describe, it, expect } from "@jest/globals";
import {
  newStreamTail,
  recordTurnChunk,
  stripRetrievalOutputs,
} from "@/server/chat/stream-filter";

type Chunk = Record<string, unknown>;

async function pump(chunks: Chunk[]): Promise<Chunk[]> {
  const stream = stripRetrievalOutputs();
  const writer = stream.writable.getWriter();
  const out: Chunk[] = [];
  const drained = (async () => {
    const reader = stream.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out.push(value as Chunk);
    }
  })();
  for (const chunk of chunks) {
    await writer.write(chunk as never);
  }
  await writer.close();
  await drained;
  return out;
}

describe("stripRetrievalOutputs", () => {
  it("drops retrieval outputs registered via tool-input-start", async () => {
    const out = await pump([
      {
        type: "tool-input-start",
        toolCallId: "c1",
        toolName: "search_documents",
      },
      {
        type: "tool-input-available",
        toolCallId: "c1",
        toolName: "search_documents",
        input: { query: "q" },
      },
      { type: "tool-output-available", toolCallId: "c1", output: "raw chunk" },
    ]);
    expect(out.map((c) => c.type)).toEqual([
      "tool-input-start",
      "tool-input-available",
    ]);
  });

  it("drops outputs of atomic tool calls that emit only tool-input-available", async () => {
    const out = await pump([
      {
        type: "tool-input-available",
        toolCallId: "c2",
        toolName: "get_page",
        input: { pageNumber: 3 },
      },
      { type: "tool-output-available", toolCallId: "c2", output: "page text" },
    ]);
    expect(out.map((c) => c.type)).toEqual(["tool-input-available"]);
  });

  it("registers retrieval call ids from tool-input-error", async () => {
    const out = await pump([
      {
        type: "tool-input-error",
        toolCallId: "c3",
        toolName: "done",
        errorText: "bad",
      },
      { type: "tool-output-error", toolCallId: "c3", errorText: "raw" },
    ]);
    expect(out.map((c) => c.type)).toEqual(["tool-input-error"]);
  });

  it("lets study-tool outputs through", async () => {
    const out = await pump([
      {
        type: "tool-input-available",
        toolCallId: "c4",
        toolName: "showQuiz",
        input: {},
      },
      { type: "tool-output-available", toolCallId: "c4", output: "rendered" },
      { type: "tool-output-error", toolCallId: "c4", errorText: "invalid" },
    ]);
    expect(out.map((c) => c.type)).toEqual([
      "tool-input-available",
      "tool-output-available",
      "tool-output-error",
    ]);
  });

  it("passes non-tool chunks through untouched", async () => {
    const chunks: Chunk[] = [
      { type: "start" },
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: "hello" },
      { type: "text-end", id: "t1" },
      { type: "finish" },
    ];
    expect(await pump(chunks)).toEqual(chunks);
  });
});

describe("recordTurnChunk", () => {
  const step = (...inner: Chunk[]): Chunk[] => [
    { type: "start-step" },
    ...inner,
    { type: "finish-step" },
  ];
  const text = (delta: string): Chunk => ({
    type: "text-delta",
    id: "t",
    delta,
  });
  const error: Chunk = { type: "error", errorText: "Failed to generate." };
  /** Record every chunk; return the tail and the chunks kept for the client. */
  const record = (chunks: Chunk[]) => {
    const tail = newStreamTail();
    const kept = chunks.filter((c) => recordTurnChunk(tail, c as never));
    return { tail, kept };
  };

  it("holds error chunks back and keeps the first one's text", () => {
    const { tail, kept } = record(
      step(text("Hi"), error, { ...error, errorText: "second" }),
    );
    expect(kept.some((c) => c.type === "error")).toBe(false);
    expect(tail.errorText).toBe("Failed to generate.");
    expect(tail.errorAfterLastStep).toBe(false);
  });

  it("tracks only the latest step's text and searches", () => {
    const { tail } = record([
      ...step(text("Let me search."), {
        type: "tool-input-start",
        toolCallId: "c1",
        toolName: "search_documents",
      }),
      ...step(text("The answer.")),
    ]);
    expect(tail.stepText).toBe("The answer.");
    expect(tail.stepStartedSearch).toBe(false);
    expect(tail.stepFinished).toBe(true);
  });

  it("does not count `done` as a search", () => {
    const { tail } = record(
      step({ type: "tool-input-start", toolCallId: "c1", toolName: "done" }),
    );
    expect(tail.stepStartedSearch).toBe(false);
  });

  it("flags an error that arrives after the last step finished", () => {
    const { tail } = record([...step(text("Let me search.")), error]);
    expect(tail.errorAfterLastStep).toBe(true);
  });

  it("leaves a step that never finished marked unfinished", () => {
    const { tail } = record([{ type: "start-step" }, text("The unit of")]);
    expect(tail.stepFinished).toBe(false);
    expect(tail.stepText).toBe("The unit of");
  });
});
