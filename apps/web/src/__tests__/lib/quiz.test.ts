import { describe, it, expect } from "@jest/globals";
import { isQuizRequest, quizSchema } from "@/lib/quiz";

describe("isQuizRequest", () => {
  it("matches common quiz phrasings", () => {
    const positives = [
      "quiz me",
      "Quiz me",
      "  QUIZ ME  ",
      "Can you quiz me?",
      "quiz me on python",
      "Start a quiz",
      "start the quiz",
      "begin a quiz",
      "give me a quiz",
      "make me a quiz on photosynthesis",
      "generate a quiz for me",
      "generate me a quiz on Python",
    ];
    for (const message of positives) {
      expect(isQuizRequest(message)).toBe(true);
    }
  });

  it("does not match unrelated messages", () => {
    const negatives = [
      "what is a quiz",
      "tell me about the syllabus",
      "explain recursion",
      "I took a quiz yesterday",
      // "quiz me" buried mid-sentence should not trigger
      "open the quiz me page",
      "the latest quiz mentioned this",
      // "test me" now belongs to Test Mode, not Quiz Mode
      "test me",
      "",
      "thanks!",
    ];
    for (const message of negatives) {
      expect(isQuizRequest(message)).toBe(false);
    }
  });
});

describe("quizSchema", () => {
  const validQuiz = {
    quiz_title: "Python Basics Quiz",
    questions: [
      {
        question: "What is the output of print(2 + 2)?",
        options: ["3", "4", "5", "Error"],
        correct_answer: "4",
        explanation: "2 + 2 equals 4 in Python.",
      },
      {
        question: "Which keyword defines a function?",
        options: ["func", "def", "function", "lambda"],
        correct_answer: "def",
        explanation: "The 'def' keyword defines functions in Python.",
      },
    ],
  };

  it("parses a well-formed quiz", () => {
    const result = quizSchema.safeParse(validQuiz);
    expect(result.success).toBe(true);
  });

  it("rejects a quiz whose correct_answer is not among the options", () => {
    const broken = {
      ...validQuiz,
      questions: [
        {
          question: "What is the output of print(2 + 2)?",
          options: ["3", "5", "Error"],
          correct_answer: "4",
          explanation: "2 + 2 equals 4 in Python.",
        },
      ],
    };
    const result = quizSchema.safeParse(broken);
    expect(result.success).toBe(false);
  });

  it("rejects a quiz with no questions", () => {
    const result = quizSchema.safeParse({
      quiz_title: "Empty",
      questions: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a question with more than four options", () => {
    const result = quizSchema.safeParse({
      quiz_title: "Too many options",
      questions: [
        {
          question: "Pick one",
          options: ["a", "b", "c", "d", "e"],
          correct_answer: "a",
          explanation: "n/a",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a question with fewer than two options", () => {
    const result = quizSchema.safeParse({
      quiz_title: "One option",
      questions: [
        {
          question: "Pick one",
          options: ["only"],
          correct_answer: "only",
          explanation: "n/a",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
