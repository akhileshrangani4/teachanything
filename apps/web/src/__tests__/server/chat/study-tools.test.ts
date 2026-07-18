import { describe, it, expect } from "@jest/globals";
import { studyTools, producedRenderableQuiz } from "@/server/chat/study-tools";

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
