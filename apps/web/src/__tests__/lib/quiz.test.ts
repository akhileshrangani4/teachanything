import { describe, it, expect } from "@jest/globals";
import { asSchema } from "ai";
import {
  quizSchema,
  isRenderableQuiz,
  isValidQuizAnswers,
  gradeQuiz,
  type Quiz,
} from "@/lib/quiz";

describe("quizSchema", () => {
  it("accepts a valid quiz", () => {
    const result = quizSchema.safeParse({
      quiz_title: "Photosynthesis",
      questions: [
        {
          question: "What gas do plants absorb?",
          options: ["CO2", "O2"],
          correct_index: 0,
          explanation: "Plants take in carbon dioxide.",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-integer correct_index", () => {
    const result = quizSchema.safeParse({
      quiz_title: "Bad",
      questions: [
        {
          question: "Q?",
          options: ["A", "B"],
          correct_index: 1.5,
          explanation: "nope",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative correct_index", () => {
    const result = quizSchema.safeParse({
      quiz_title: "Bad",
      questions: [
        {
          question: "Q?",
          options: ["A", "B"],
          correct_index: -1,
          explanation: "nope",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an over-long quiz_title", () => {
    // The title reaches the dashboard, exports, and (sanitized) the model
    // results note -- it must be bounded at the schema so the model can't be
    // steered into emitting a multi-KB title.
    const result = quizSchema.safeParse({
      quiz_title: "x".repeat(201),
      questions: [
        {
          question: "Q?",
          options: ["A", "B"],
          correct_index: 0,
          explanation: "x",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 5 questions", () => {
    const q = {
      question: "Q?",
      options: ["A", "B"],
      correct_index: 0,
      explanation: "x",
    };
    const result = quizSchema.safeParse({
      quiz_title: "Too long",
      questions: Array(6).fill(q),
    });
    expect(result.success).toBe(false);
  });

  it("exposes correct_index (not correct_answer) in the model-facing JSON schema", () => {
    // The correct answer is an index, not a cross-field (`answer in options`)
    // refinement. Refinements are stripped from the JSON schema the model
    // receives, so an index -- which zod expresses as a plain integer bound --
    // is the constraint the model actually sees. Assert against the SAME
    // converter the AI SDK uses for a tool's inputSchema (`asSchema`), not a
    // stand-in like `z.toJSONSchema`, so the test tracks what the model is
    // really sent.
    const jsonSchema = JSON.stringify(asSchema(quizSchema).jsonSchema);
    expect(jsonSchema).toContain("correct_index");
    expect(jsonSchema).not.toContain("correct_answer");
  });
});

describe("isRenderableQuiz", () => {
  const question = (correct_index: number) => ({
    question: "Q?",
    options: ["A", "B"],
    correct_index,
    explanation: "x",
  });

  it("accepts a quiz whose correct_index points at a real option", () => {
    expect(
      isRenderableQuiz({ quiz_title: "T", questions: [question(1)] }),
    ).toBe(true);
  });

  it("rejects a quiz whose correct_index is out of range", () => {
    // Structurally valid (index >= 0) but points past the options, so it would
    // render an unwinnable quiz with no correct option.
    expect(
      isRenderableQuiz({ quiz_title: "T", questions: [question(2)] }),
    ).toBe(false);
  });

  it("rejects when any one question is out of range", () => {
    expect(
      isRenderableQuiz({
        quiz_title: "T",
        questions: [question(0), question(5)],
      }),
    ).toBe(false);
  });
});

describe("isValidQuizAnswers", () => {
  const quiz: Quiz = {
    quiz_title: "T",
    questions: [
      {
        question: "Q1",
        options: ["A", "B", "C"],
        correct_index: 2,
        explanation: "x",
      },
      {
        question: "Q2",
        options: ["A", "B"],
        correct_index: 0,
        explanation: "x",
      },
    ],
  };

  it("accepts one in-range answer per question", () => {
    expect(isValidQuizAnswers(quiz, [1, 0])).toBe(true);
  });

  it("rejects a wrong-length answer array", () => {
    expect(isValidQuizAnswers(quiz, [1])).toBe(false);
    expect(isValidQuizAnswers(quiz, [1, 0, 1])).toBe(false);
  });

  it("rejects an out-of-range selection", () => {
    expect(isValidQuizAnswers(quiz, [3, 0])).toBe(false); // Q1 has 3 options (0-2)
    expect(isValidQuizAnswers(quiz, [0, -1])).toBe(false);
  });

  it("rejects a non-integer selection", () => {
    expect(isValidQuizAnswers(quiz, [1.5, 0])).toBe(false);
  });
});

describe("gradeQuiz", () => {
  const quiz: Quiz = {
    quiz_title: "T",
    questions: [
      {
        question: "Q1",
        options: ["A", "B", "C"],
        correct_index: 2,
        explanation: "x",
      },
      {
        question: "Q2",
        options: ["A", "B"],
        correct_index: 0,
        explanation: "x",
      },
    ],
  };

  it("computes score against correct_index and echoes answers", () => {
    expect(gradeQuiz(quiz, [2, 0])).toEqual({
      answers: [2, 0],
      score: 2,
      total: 2,
    });
    expect(gradeQuiz(quiz, [2, 1])).toEqual({
      answers: [2, 1],
      score: 1,
      total: 2,
    });
    expect(gradeQuiz(quiz, [0, 1])).toEqual({
      answers: [0, 1],
      score: 0,
      total: 2,
    });
  });
});
