import { describe, it, expect } from "@jest/globals";
import { findQuizByToolCallId } from "@/server/study/request";

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

describe("findQuizByToolCallId", () => {
  it("finds the quiz for a matching tool-showQuiz part", () => {
    const rows = [
      rowWithParts([
        { type: "text", text: "here you go" },
        { type: "tool-showQuiz", toolCallId: "call_1", input: quiz },
      ]),
    ];
    expect(findQuizByToolCallId(rows, "call_1")).toEqual(quiz);
  });

  it("returns null when the toolCallId does not match", () => {
    const rows = [
      rowWithParts([
        { type: "tool-showQuiz", toolCallId: "call_1", input: quiz },
      ]),
    ];
    expect(findQuizByToolCallId(rows, "call_2")).toBeNull();
  });

  it("ignores non-quiz tool parts with the same id", () => {
    const rows = [
      rowWithParts([
        { type: "tool-search_documents", toolCallId: "call_1", input: {} },
      ]),
    ];
    expect(findQuizByToolCallId(rows, "call_1")).toBeNull();
  });

  it("returns null when the stored input is not a valid quiz", () => {
    const rows = [
      rowWithParts([
        { type: "tool-showQuiz", toolCallId: "call_1", input: { bogus: true } },
      ]),
    ];
    expect(findQuizByToolCallId(rows, "call_1")).toBeNull();
  });

  it("tolerates rows with missing or malformed metadata/parts", () => {
    const rows = [
      { metadata: null },
      { metadata: {} },
      { metadata: { parts: "nope" } },
      rowWithParts([
        { type: "tool-showQuiz", toolCallId: "call_1", input: quiz },
      ]),
    ];
    expect(findQuizByToolCallId(rows, "call_1")).toEqual(quiz);
  });
});
