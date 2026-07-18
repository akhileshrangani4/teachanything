import { describe, it, expect } from "@jest/globals";
import { findToolPartByToolCallId } from "@/server/study/request";

const quiz = {
  quiz_title: "Photosynthesis",
  questions: [
    {
      question: "What gas do plants absorb?",
      options: ["CO2", "O2"],
      correct_index: 0,
      explanation: "Plants take in carbon dioxide.",
    },
  ],
};

function rowWithParts(parts: unknown[]) {
  return { metadata: { parts } };
}

describe("findToolPartByToolCallId", () => {
  it("returns the tool name and shown input for a matching part", () => {
    const rows = [
      rowWithParts([
        { type: "text", text: "here you go" },
        { type: "tool-showQuiz", toolCallId: "call_1", input: quiz },
      ]),
    ];
    expect(findToolPartByToolCallId(rows, "call_1")).toEqual({
      toolName: "showQuiz",
      input: quiz,
    });
  });

  it("is tool-agnostic (works for any tool-* part)", () => {
    const rows = [
      rowWithParts([
        {
          type: "tool-showFlashcards",
          toolCallId: "call_9",
          input: { cards: [] },
        },
      ]),
    ];
    expect(findToolPartByToolCallId(rows, "call_9")).toEqual({
      toolName: "showFlashcards",
      input: { cards: [] },
    });
  });

  it("returns null when the toolCallId does not match", () => {
    const rows = [
      rowWithParts([
        { type: "tool-showQuiz", toolCallId: "call_1", input: quiz },
      ]),
    ];
    expect(findToolPartByToolCallId(rows, "call_2")).toBeNull();
  });

  it("ignores non-tool parts and tolerates malformed metadata", () => {
    const rows = [
      { metadata: null },
      { metadata: {} },
      { metadata: { parts: "nope" } },
      rowWithParts([{ type: "text", text: "hi" }]),
      rowWithParts([
        { type: "tool-showQuiz", toolCallId: "call_1", input: quiz },
      ]),
    ];
    expect(findToolPartByToolCallId(rows, "call_1")).toEqual({
      toolName: "showQuiz",
      input: quiz,
    });
  });
});
