import { describe, it, expect } from "@jest/globals";
import { messageExportContent, formatQuizForExport } from "@/lib/export-chat";
import type { Quiz } from "@/lib/quiz";

describe("messageExportContent", () => {
  it("returns the joined text for a normal message", () => {
    expect(
      messageExportContent({
        id: "m1",
        role: "assistant",
        parts: [
          { type: "text", text: "line one" },
          { type: "text", text: "line two" },
        ],
      } as never),
    ).toBe("line one\nline two");
  });

  it("substitutes a placeholder for a quiz-only turn (no text parts)", () => {
    // Otherwise the export writes a blank "[N] Assistant:" line.
    expect(
      messageExportContent({
        id: "m2",
        role: "assistant",
        parts: [
          {
            type: "tool-showQuiz",
            toolCallId: "c",
            state: "output-available",
            output: "rendered",
            input: {
              quiz_title: "Photosynthesis",
              questions: [
                {
                  question: "Q?",
                  options: ["A", "B"],
                  correct_index: 0,
                  explanation: "x",
                },
              ],
            },
          },
        ],
      } as never),
    ).toBe("[Interactive quiz: Photosynthesis]");
  });

  it("marks an unrenderable quiz as not generated (mirrors the client notice)", () => {
    // The client showed "Couldn't build the quiz", so the export must not
    // claim an interactive quiz existed.
    expect(
      messageExportContent({
        id: "m3",
        role: "assistant",
        parts: [
          {
            type: "tool-showQuiz",
            toolCallId: "c",
            state: "output-available",
            output: "rendered",
            input: { quiz_title: "Broken", questions: [] },
          },
        ],
      } as never),
    ).toBe("[Quiz could not be generated]");
  });
});

describe("formatQuizForExport", () => {
  const quiz: Quiz = {
    quiz_title: "Photosynthesis",
    questions: [
      {
        question: "What gas do plants absorb?",
        options: ["CO2", "O2"],
        correct_index: 0,
        explanation: "Plants take in carbon dioxide.",
      },
      {
        question: "What do plants release?",
        options: ["CO2", "O2"],
        correct_index: 1,
        explanation: "They release oxygen.",
      },
    ],
  };

  it("lists questions with the correct option marked", () => {
    const out = formatQuizForExport(quiz, []);
    expect(out).toContain("Quiz: Photosynthesis");
    expect(out).toContain("A. CO2  [correct]"); // Q1 correct
    expect(out).toContain("B. O2  [correct]"); // Q2 correct
    expect(out).toContain("(no answer submitted)");
  });

  it("renders each attempt with the student's picks and score", () => {
    const out = formatQuizForExport(quiz, [
      { answers: [0, 0], score: 1, total: 2 },
      { answers: [0, 1], score: 2, total: 2 },
    ]);
    expect(out).toContain("Attempt 1 — score 1/2:");
    expect(out).toContain("Q1: CO2 (correct)");
    expect(out).toContain("Q2: CO2 (incorrect)");
    expect(out).toContain("Attempt 2 — score 2/2:");
    expect(out).toContain("Q2: O2 (correct)");
  });

  it("handles a missing/short answer entry gracefully", () => {
    const out = formatQuizForExport(quiz, [
      { answers: [0], score: 1, total: 2 },
    ]);
    expect(out).toContain("Q2: (no answer) (incorrect)");
  });
});
