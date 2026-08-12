import { describe, it, expect } from "@jest/globals";
import {
  studyTools,
  producedRenderableQuiz,
  maxQuestionsForBudget,
  buildStudyToolsAddendum,
} from "@/server/chat/study-tools";

describe("studyTools", () => {
  it("registers showQuiz with the quiz schema and no execute", () => {
    expect(studyTools.showQuiz).toBeDefined();
    expect(studyTools.showQuiz.inputSchema).toBeDefined();
    // Render-only tool: no server-side execute.
    expect(studyTools.showQuiz.execute).toBeUndefined();
  });

  it("showQuiz inputSchema validates a quiz payload", () => {
    const parsed = studyTools.showQuiz.inputSchema.safeParse({
      quiz_title: "T",
      questions: [
        {
          question: "Q?",
          options: ["A", "B"],
          correct_index: 0,
          explanation: "x",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("producedRenderableQuiz", () => {
  const quizInput = (correct_index = 0) => ({
    quiz_title: "T",
    questions: [
      { question: "Q?", options: ["A", "B"], correct_index, explanation: "x" },
    ],
  });

  it("counts a valid, in-range showQuiz call as a rendered quiz", () => {
    expect(
      producedRenderableQuiz([{ toolName: "showQuiz", input: quizInput() }]),
    ).toBe(true);
    expect(
      producedRenderableQuiz([
        { toolName: "showQuiz", invalid: false, input: quizInput(1) },
      ]),
    ).toBe(true);
  });

  it("counts a call whose input only needs repair to render", () => {
    // The client repairs these on the way to the browser (repairQuizToolParts),
    // so the student does get a quiz and the fallback must stay off.
    expect(
      producedRenderableQuiz([
        {
          toolName: "showQuiz",
          invalid: true,
          input: {
            quiz_title: "T",
            questions: Array(7).fill({
              question: "Q?",
              options: ["A", "B"],
              correct_index: 0,
              explanation: "x",
            }),
          },
        },
      ]),
    ).toBe(true);
  });

  it("counts a call whose input was cut off after one question", () => {
    const full = JSON.stringify({
      quiz_title: "T",
      questions: [
        {
          question: "Q1?",
          options: ["A", "B"],
          correct_index: 0,
          explanation: "x",
        },
        {
          question: "Q2?",
          options: ["A", "B"],
          correct_index: 0,
          explanation: "x",
        },
      ],
    });
    expect(
      producedRenderableQuiz([
        {
          toolName: "showQuiz",
          invalid: true,
          input: full.slice(0, full.indexOf("Q2?")),
        },
      ]),
    ).toBe(true);
  });

  it("does NOT count a showQuiz call whose input failed validation", () => {
    // The SDK returns a schema-invalid tool call with `invalid: true`; it shows
    // the student an error, not a quiz, so it must not suppress the fallback.
    expect(
      producedRenderableQuiz([{ toolName: "showQuiz", invalid: true }]),
    ).toBe(false);
  });

  it("does NOT count a showQuiz call whose correct_index is out of range", () => {
    // Structurally valid (not flagged invalid) but unrenderable -- it must fall
    // through to the empty-response fallback like a malformed quiz.
    expect(
      producedRenderableQuiz([{ toolName: "showQuiz", input: quizInput(2) }]),
    ).toBe(false);
  });

  it("ignores non-quiz tool calls", () => {
    expect(producedRenderableQuiz([{ toolName: "search_documents" }])).toBe(
      false,
    );
    expect(producedRenderableQuiz([])).toBe(false);
  });

  it("counts the valid quiz even when an invalid one is also present", () => {
    expect(
      producedRenderableQuiz([
        { toolName: "showQuiz", invalid: true },
        { toolName: "showQuiz", invalid: false, input: quizInput() },
      ]),
    ).toBe(true);
  });
});

describe("maxQuestionsForBudget", () => {
  it("allows the full quiz when the budget is roomy", () => {
    expect(maxQuestionsForBudget(2000)).toBe(5);
    expect(maxQuestionsForBudget(4000)).toBe(5);
    expect(maxQuestionsForBudget(1000)).toBe(5);
  });

  it("scales down as the reply limit tightens", () => {
    expect(maxQuestionsForBudget(800)).toBe(4);
    expect(maxQuestionsForBudget(500)).toBe(2);
  });

  it("never asks for fewer than one question", () => {
    // 100 is the floor clampMaxTokens allows; a quiz can't really fit, but the
    // model must still be asked for something rather than zero questions.
    expect(maxQuestionsForBudget(100)).toBe(1);
    expect(maxQuestionsForBudget(0)).toBe(1);
  });
});

describe("buildStudyToolsAddendum", () => {
  it("tells the model the question budget", () => {
    expect(buildStudyToolsAddendum(500)).toContain("at most 2 questions");
    expect(buildStudyToolsAddendum(2000)).toContain("at most 5 questions");
  });

  it("uses the singular for a one-question budget", () => {
    expect(buildStudyToolsAddendum(150)).toContain("at most 1 question,");
  });

  it("still tells the model to call the tool rather than write prose", () => {
    expect(buildStudyToolsAddendum(2000)).toContain("showQuiz");
    expect(buildStudyToolsAddendum(2000)).toContain(
      "do not write the quiz out as prose",
    );
  });
});
