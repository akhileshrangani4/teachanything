import { describe, it, expect } from "@jest/globals";
import { asSchema } from "ai";
import {
  quizSchema,
  isRenderableQuiz,
  isValidQuizAnswers,
  gradeQuiz,
  initialQuizWidgetState,
  parseQuizFromText,
  repairQuiz,
  type Quiz,
  type QuizResponse,
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

describe("initialQuizWidgetState", () => {
  const attempt = (answers: number[]): QuizResponse => ({
    answers,
    score: 0,
    total: answers.length,
  });

  it("starts fresh when there are no attempts", () => {
    expect(initialQuizWidgetState(3, undefined)).toEqual({
      currentIndex: 0,
      selected: [null, null, null],
      finished: false,
    });
    expect(initialQuizWidgetState(3, [])).toEqual({
      currentIndex: 0,
      selected: [null, null, null],
      finished: false,
    });
  });

  it("restores the finished view from the most recent attempt", () => {
    const state = initialQuizWidgetState(3, [
      attempt([0, 1, 2]),
      attempt([2, 0, 1]),
    ]);
    expect(state).toEqual({
      currentIndex: 2,
      selected: [2, 0, 1],
      finished: true,
    });
  });

  it("copies the stored answers rather than aliasing them", () => {
    const stored = attempt([1, 0]);
    const state = initialQuizWidgetState(2, [stored]);
    state.selected[0] = 9;
    expect(stored.answers).toEqual([1, 0]);
  });

  it("falls back to a fresh start when stored answers don't match the quiz length", () => {
    // A length mismatch would mis-score the finished view, so ignore it.
    expect(initialQuizWidgetState(3, [attempt([0, 1])])).toEqual({
      currentIndex: 0,
      selected: [null, null, null],
      finished: false,
    });
  });
});

describe("repairQuiz", () => {
  const question = (i: number, over = false) => ({
    question: `Q${i}?`,
    options: ["A", "B", "C", "D"],
    correct_index: over ? 9 : i % 4,
    explanation: `because ${i}`,
  });

  it("passes an already-valid quiz through unchanged", () => {
    const quiz = { quiz_title: "T", questions: [question(1)] };
    expect(repairQuiz(quiz)).toEqual(quiz);
  });

  it("trims a quiz with more questions than the schema allows", () => {
    const repaired = repairQuiz({
      quiz_title: "T",
      questions: [1, 2, 3, 4, 5, 6, 7].map((i) => question(i)),
    });
    expect(repaired?.questions).toHaveLength(5);
    expect(repaired?.questions[0]?.question).toBe("Q1?");
  });

  it("drops a question missing its explanation and keeps the rest", () => {
    const repaired = repairQuiz({
      quiz_title: "T",
      questions: [
        question(1),
        { question: "Q2?", options: ["A", "B"], correct_index: 0 },
        question(3),
      ],
    });
    expect(repaired?.questions.map((q) => q.question)).toEqual(["Q1?", "Q3?"]);
  });

  it("drops a question whose correct_index is out of range", () => {
    const repaired = repairQuiz({
      quiz_title: "T",
      questions: [question(1, true), question(2)],
    });
    expect(repaired?.questions.map((q) => q.question)).toEqual(["Q2?"]);
  });

  it("drops a question with too many options", () => {
    const repaired = repairQuiz({
      quiz_title: "T",
      questions: [
        { ...question(1), options: ["A", "B", "C", "D", "E"] },
        question(2),
      ],
    });
    expect(repaired?.questions.map((q) => q.question)).toEqual(["Q2?"]);
  });

  it("returns null when no question survives", () => {
    expect(
      repairQuiz({ quiz_title: "T", questions: [question(1, true)] }),
    ).toBeNull();
    expect(repairQuiz({ quiz_title: "T", questions: [] })).toBeNull();
  });

  it("returns null for input that isn't a quiz at all", () => {
    expect(repairQuiz(undefined)).toBeNull();
    expect(repairQuiz(null)).toBeNull();
    expect(repairQuiz(42)).toBeNull();
    expect(repairQuiz("not json")).toBeNull();
    expect(repairQuiz({ quiz_title: "T" })).toBeNull();
    expect(repairQuiz({ questions: [question(1)] })).toBeNull();
  });

  it("truncates an over-long title rather than rejecting the quiz", () => {
    const repaired = repairQuiz({
      quiz_title: "x".repeat(500),
      questions: [question(1)],
    });
    expect(repaired?.quiz_title).toHaveLength(200);
  });

  describe("input cut off by the token limit", () => {
    const full = JSON.stringify({
      quiz_title: "Shakespeare",
      questions: [question(1), question(2), question(3)],
    });

    it("keeps the questions that finished writing", () => {
      // Cut in the middle of the third question.
      const cut = full.slice(0, full.indexOf("Q3?") + 1);
      const repaired = repairQuiz(cut);
      expect(repaired?.quiz_title).toBe("Shakespeare");
      expect(repaired?.questions.map((q) => q.question)).toEqual([
        "Q1?",
        "Q2?",
      ]);
    });

    it("keeps a single completed question", () => {
      const cut = full.slice(0, full.indexOf("Q2?"));
      expect(repairQuiz(cut)?.questions).toHaveLength(1);
    });

    it("returns null when not even one question finished", () => {
      const cut = full.slice(0, full.indexOf("questions") + 20);
      expect(repairQuiz(cut)).toBeNull();
    });

    it("returns null when the title never arrived", () => {
      const titleLast = JSON.stringify({
        questions: [question(1)],
        quiz_title: "Shakespeare",
      });
      const cut = titleLast.slice(0, titleLast.indexOf("quiz_title"));
      expect(repairQuiz(cut)).toBeNull();
    });

    it("still repairs a complete-but-oversized JSON string", () => {
      const oversized = JSON.stringify({
        quiz_title: "T",
        questions: [1, 2, 3, 4, 5, 6].map((i) => question(i)),
      });
      expect(repairQuiz(oversized)?.questions).toHaveLength(5);
    });
  });
});

describe("parseQuizFromText", () => {
  const validQuiz = {
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

  it("recovers a quiz from a bare JSON blob", () => {
    expect(parseQuizFromText(JSON.stringify(validQuiz))).toEqual(validQuiz);
  });

  it("recovers a quiz wrapped in a ```json code fence", () => {
    const fenced = "```json\n" + JSON.stringify(validQuiz) + "\n```";
    expect(parseQuizFromText(fenced)).toEqual(validQuiz);
  });

  it("recovers a quiz with leading/trailing prose around the JSON", () => {
    const text = `Sure! Here you go:\n${JSON.stringify(validQuiz)}\nGood luck!`;
    expect(parseQuizFromText(text)).toEqual(validQuiz);
  });

  it("handles braces inside question/option strings", () => {
    const quiz = {
      quiz_title: "Sets",
      questions: [
        {
          question: "Which is the empty set {}?",
          options: ["{}", "{1}"],
          correct_index: 0,
          explanation: "The empty set {} has no elements.",
        },
      ],
    };
    expect(parseQuizFromText(JSON.stringify(quiz))).toEqual(quiz);
  });

  it("returns null for ordinary prose", () => {
    expect(parseQuizFromText("Here is a summary of the topic.")).toBeNull();
  });

  it("returns null for non-quiz JSON", () => {
    expect(parseQuizFromText('{"foo":"bar"}')).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseQuizFromText('{"quiz_title": "x", questions:')).toBeNull();
  });

  it("returns null for a structurally valid but unrenderable quiz", () => {
    // correct_index points past the options -> not renderable.
    const bad = {
      quiz_title: "Bad",
      questions: [
        {
          question: "Q?",
          options: ["A", "B"],
          correct_index: 5,
          explanation: "x",
        },
      ],
    };
    expect(parseQuizFromText(JSON.stringify(bad))).toBeNull();
  });

  // Some models serialize the call in their native pseudo-call syntax --
  // `[showQuiz(quiz_title="...", questions=[...])]` -- rather than as a JSON
  // object. Observed in production 2026-08-07 (a Llama-family bot).
  describe("pseudo tool-call syntax", () => {
    const pseudoCall = (title: string, questions: unknown) =>
      `[showQuiz(quiz_title="${title}", questions=${JSON.stringify(questions)})]`;

    it("recovers a quiz from bracketed pseudo-call syntax", () => {
      expect(
        parseQuizFromText(pseudoCall("Photosynthesis", validQuiz.questions)),
      ).toEqual(validQuiz);
    });

    it("recovers a pseudo-call without the wrapping brackets", () => {
      const call = `showQuiz(quiz_title="Photosynthesis", questions=${JSON.stringify(validQuiz.questions)})`;
      expect(parseQuizFromText(call)).toEqual(validQuiz);
    });

    it("recovers a pseudo-call after a prose preamble", () => {
      const text = `Here are some quiz questions.\n\n${pseudoCall("Photosynthesis", validQuiz.questions)}`;
      expect(parseQuizFromText(text)).toEqual(validQuiz);
    });

    it("handles keyword args in either order", () => {
      const call = `showQuiz(questions=${JSON.stringify(validQuiz.questions)}, quiz_title="Photosynthesis")`;
      expect(parseQuizFromText(call)).toEqual(validQuiz);
    });

    it("handles nested brackets inside question text", () => {
      const questions = [
        {
          question: "Which list is empty: [] or [0]?",
          options: ["[]", "[0]"],
          correct_index: 0,
          explanation: "[] has no elements.",
        },
      ];
      expect(parseQuizFromText(pseudoCall("Lists", questions))).toEqual({
        quiz_title: "Lists",
        questions,
      });
    });

    it("returns null when the questions payload is not valid JSON", () => {
      const call = `showQuiz(quiz_title="X", questions=[{question: 'unquoted', options: []}])`;
      expect(parseQuizFromText(call)).toBeNull();
    });

    it("returns null for a pseudo-call naming a different tool", () => {
      expect(
        parseQuizFromText(
          `[showFlashcards(quiz_title="X", questions=${JSON.stringify(validQuiz.questions)})]`,
        ),
      ).toBeNull();
    });

    it("returns null for prose that merely mentions showQuiz", () => {
      expect(
        parseQuizFromText("I would call showQuiz() but there is no material."),
      ).toBeNull();
    });
  });

  /**
   * A leak must recover exactly when the same quiz would have recovered had the
   * model used the tool channel -- the native path runs `repairQuiz` twice
   * (`experimental_repairToolCall`, `repairQuizToolParts`) while this path used
   * to demand a schema-perfect quiz. Every case below was previously discarded
   * whole, which flushed the raw call -- answer keys and explanations included --
   * to the student as text.
   */
  describe("repairs a leak the way a tool call is repaired", () => {
    const question = (i: number) => ({
      question: `Q${i}: what does Barbie stage about gender?`,
      options: ["A", "B", "C", "D"],
      correct_index: 2,
      explanation: `Because ${i}.`,
    });

    it("trims a leak that runs past the question ceiling", () => {
      const quiz = {
        quiz_title: "Gender Theory and Barbie",
        questions: [1, 2, 3, 4, 5, 6].map(question),
      };
      const recovered = parseQuizFromText(JSON.stringify(quiz));
      expect(recovered?.questions).toHaveLength(5);
      expect(recovered?.quiz_title).toBe("Gender Theory and Barbie");
    });

    it("coerces an aliased answer key in a leaked quiz", () => {
      const leaked = {
        quiz_title: "Gender Theory",
        questions: [
          {
            question: "Who wrote Gender Trouble?",
            options: ["Butler", "Foucault", "Sedgwick", "Ahmed"],
            answer: "A",
            explanation: "Judith Butler, 1990.",
          },
        ],
      };
      expect(parseQuizFromText(JSON.stringify(leaked))?.questions[0]).toEqual(
        expect.objectContaining({ correct_index: 0 }),
      );
    });

    it("drops one botched question and keeps the rest", () => {
      const leaked = {
        quiz_title: "Gender Theory",
        questions: [
          question(1),
          { question: "Too many options?", options: ["A", "B", "C", "D", "E"] },
          question(2),
        ],
      };
      const recovered = parseQuizFromText(JSON.stringify(leaked));
      expect(recovered?.questions).toHaveLength(2);
      expect(recovered?.questions.map((q) => q.question)).toEqual([
        "Q1: what does Barbie stage about gender?",
        "Q2: what does Barbie stage about gender?",
      ]);
    });

    it("salvages a JSON leak the token limit cut off mid-question", () => {
      const full = JSON.stringify({
        quiz_title: "Gender Theory",
        questions: [question(1), question(2), question(3)],
      });
      const cutOff = full.slice(0, full.indexOf("Q3:") + 2);
      const recovered = parseQuizFromText(cutOff);
      expect(recovered?.questions).toHaveLength(2);
    });

    it("salvages a pseudo-call whose questions array never closes", () => {
      // How Llama-family models leak, cut off by `maxTokens` mid-write.
      const full = `[showQuiz(quiz_title="Gender Theory", questions=${JSON.stringify(
        [question(1), question(2), question(3)],
      )})]`;
      const cutOff = full.slice(0, full.indexOf("Q3:") + 2);
      const recovered = parseQuizFromText(cutOff);
      expect(recovered?.quiz_title).toBe("Gender Theory");
      expect(recovered?.questions).toHaveLength(2);
    });

    it("still returns null when a truncated leak has no complete question", () => {
      expect(
        parseQuizFromText('{"quiz_title":"Gender Theory","questions":[{"que'),
      ).toBeNull();
      expect(
        parseQuizFromText('[showQuiz(quiz_title="Gender Theory", questions=[{'),
      ).toBeNull();
    });
  });
});
