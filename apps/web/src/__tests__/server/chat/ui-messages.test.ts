import { describe, it, expect } from "@jest/globals";
import {
  rowToUIMessage,
  extractText,
  assistantMessageForDb,
} from "@/server/chat/ui-messages";

describe("rowToUIMessage", () => {
  it("rehydrates a legacy text row (no parts) into a single text part", () => {
    const msg = rowToUIMessage({
      id: "m1",
      role: "assistant",
      content: "Hello there",
      metadata: {},
    });
    expect(msg.role).toBe("assistant");
    expect(msg.parts).toEqual([{ type: "text", text: "Hello there" }]);
  });

  it("rehydrates a tool message from metadata.parts", () => {
    const parts = [
      { type: "text", text: "Here is a quiz:" },
      {
        type: "tool-showQuiz",
        toolCallId: "c1",
        state: "input-available",
        input: { quiz_title: "T", questions: [] },
      },
    ];
    const msg = rowToUIMessage({
      id: "m2",
      role: "assistant",
      content: "Here is a quiz:",
      metadata: { parts },
    });
    expect(msg.parts).toEqual(parts);
  });

  it("carries metadata (sources/truncated/responseTime) for the dashboard viewer", () => {
    const sources = [{ fileName: "a.pdf", chunkIndex: 1, similarity: 0.9 }];
    const msg = rowToUIMessage({
      id: "m4",
      role: "assistant",
      content: "hi",
      metadata: { sources, truncated: true, responseTime: 120 },
    });
    expect(msg.metadata?.sources).toEqual(sources);
    expect(msg.metadata?.truncated).toBe(true);
    expect(msg.metadata?.responseTime).toBe(120);
  });

  it("leaves metadata fields undefined for a legacy row", () => {
    const msg = rowToUIMessage({
      id: "m5",
      role: "assistant",
      content: "legacy",
      metadata: {},
    });
    expect(msg.metadata?.sources).toBeUndefined();
    expect(msg.metadata?.truncated).toBeUndefined();
  });
});

describe("extractText", () => {
  it("joins only text parts", () => {
    expect(
      extractText([
        { type: "text", text: "a" },
        {
          type: "tool-showQuiz",
          toolCallId: "c",
          state: "input-available",
          input: {},
        },
        { type: "text", text: "b" },
      ] as never),
    ).toBe("a\nb");
  });

  it("returns empty string for a quiz-only turn (no text parts)", () => {
    // Load-bearing: this empty content drives the `content.trim() ||
    // hasStudyPart` persistence branch so quiz-only turns still save.
    expect(
      extractText([
        {
          type: "tool-showQuiz",
          toolCallId: "c",
          state: "input-available",
          input: {},
        },
      ] as never),
    ).toBe("");
  });
});

describe("assistantMessageForDb", () => {
  it("returns joined text as content and the full parts array", () => {
    const out = assistantMessageForDb({
      id: "m3",
      role: "assistant",
      parts: [
        { type: "text", text: "hi" },
        {
          type: "tool-showQuiz",
          toolCallId: "c",
          state: "input-available",
          input: {},
        },
      ],
    } as never);
    expect(out.content).toBe("hi");
    expect(out.parts).toHaveLength(2);
  });
});
