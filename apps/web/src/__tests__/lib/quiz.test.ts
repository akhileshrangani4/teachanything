import { describe, it, expect } from "@jest/globals";
import { z } from "zod";
import { quizSchema } from "@/lib/quiz";

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

  it("uses only structural constraints so the model-facing JSON schema carries them", () => {
    // The correct answer is an index, not a cross-field (`answer in options`)
    // refinement. Refinements are stripped from the JSON schema the model
    // receives, so an index -- which zod expresses as a plain integer bound --
    // is the constraint the model actually sees. Guard: a mismatch can no
    // longer land as an SDK validation error that suppresses the fallback, so
    // an in-range structural quiz always parses.
    const jsonSchema = z.toJSONSchema(quizSchema);
    expect(JSON.stringify(jsonSchema)).toContain("correct_index");
    expect(JSON.stringify(jsonSchema)).not.toContain("correct_answer");
  });
});
