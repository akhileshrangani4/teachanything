import { describe, it, expect } from "@jest/globals";
import { stripRetrievalOutputs } from "@/server/chat/stream-filter";

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
