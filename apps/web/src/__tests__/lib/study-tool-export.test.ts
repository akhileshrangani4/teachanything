import { describe, it, expect } from "@jest/globals";
import {
  renderStudyToolsText,
  renderStudyToolsHtml,
  type ExportStudyTool,
} from "@/lib/study-tool-export";

const quiz = {
  quiz_title: "Photosynthesis",
  questions: [
    {
      question: "What gas do plants absorb?",
      options: ["Oxygen", "CO2", "Nitrogen"],
      correct_index: 1,
      explanation: "Plants take in carbon dioxide.",
    },
  ],
};

function quizTool(overrides: Partial<ExportStudyTool> = {}): ExportStudyTool {
  return {
    toolName: "showQuiz",
    input: quiz,
    responses: [{ attempt: 1, response: { answers: [2], score: 0, total: 1 } }],
    ...overrides,
  };
}

describe("renderStudyToolsText — quiz", () => {
  it("renders questions, the correct option, and the student's graded answer", () => {
    const text = renderStudyToolsText([quizTool()]);
    expect(text).toContain("Quiz: Photosynthesis");
    expect(text).toContain("What gas do plants absorb?");
    expect(text).toContain("B. CO2  [correct]");
    expect(text).toContain("Attempt 1 — score 0/1");
    // The student picked option index 2 (Nitrogen) => incorrect.
    expect(text).toContain("Q1: Nitrogen (incorrect)");
  });

  it("orders multiple attempts by attempt number", () => {
    const text = renderStudyToolsText([
      quizTool({
        responses: [
          { attempt: 2, response: { answers: [1], score: 1, total: 1 } },
          { attempt: 1, response: { answers: [0], score: 0, total: 1 } },
        ],
      }),
    ]);
    expect(text.indexOf("score 0/1")).toBeLessThan(text.indexOf("score 1/1"));
  });

  it("notes when no answer was submitted", () => {
    const text = renderStudyToolsText([quizTool({ responses: [] })]);
    expect(text).toContain("(no answer submitted)");
  });

  it("flags an unrenderable quiz instead of inventing one", () => {
    const text = renderStudyToolsText([
      quizTool({ input: { quiz_title: "Broken", questions: [] } }),
    ]);
    expect(text).toContain("[Quiz could not be generated]");
  });
});

describe("renderStudyToolsHtml — quiz", () => {
  it("marks the correct option and grades each attempt, escaping content", () => {
    const html = renderStudyToolsHtml([
      quizTool({
        input: {
          quiz_title: "Tricky <x>",
          questions: [
            {
              question: "Pick <b>one</b>",
              options: ["a", "b"],
              correct_index: 0,
              explanation: "because",
            },
          ],
        },
        responses: [
          { attempt: 1, response: { answers: [0], score: 1, total: 1 } },
        ],
      }),
    ]);
    expect(html).toContain('class="opt correct"');
    expect(html).toContain("Attempt 1 — score 1/1");
    // Injected markup is escaped, not emitted raw.
    expect(html).not.toContain("<b>one</b>");
    expect(html).toContain("&lt;b&gt;one&lt;/b&gt;");
    expect(html).toContain("Tricky &lt;x&gt;");
  });
});

describe("generic fallback — unknown study tools", () => {
  const flashcards: ExportStudyTool = {
    toolName: "showFlashcards",
    input: { cards: [{ front: "Q", back: "A" }] },
    responses: [{ attempt: 1, response: { reviewed: 3 } }],
  };

  it("renders unknown tools losslessly as text", () => {
    const text = renderStudyToolsText([flashcards]);
    expect(text).toContain("[Study tool: showFlashcards]");
    expect(text).toContain('"front":"Q"');
    expect(text).toContain('"reviewed":3');
  });

  it("renders unknown tools as escaped HTML", () => {
    const html = renderStudyToolsHtml([flashcards]);
    expect(html).toContain("Study tool: showFlashcards");
    expect(html).toContain("tool-raw");
  });
});

describe("empty", () => {
  it("returns empty strings when there are no tools", () => {
    expect(renderStudyToolsText([])).toBe("");
    expect(renderStudyToolsHtml([])).toBe("");
  });
});
