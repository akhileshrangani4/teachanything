import { describe, it, expect } from "@jest/globals";
import { coerceCorrectIndex } from "@/lib/questions";
import { repairQuiz } from "@/lib/quiz";

const OPTIONS = ["Alpha", "Bravo", "Charlie", "Delta"];
const base = { question: "Q?", options: OPTIONS, explanation: "because" };

const indexOf = (question: unknown) =>
  (question as { correct_index?: unknown }).correct_index;

/**
 * Measured against the live model registry on 2026-08-17: GPT-OSS 120B never
 * emits `correct_index`, substituting `answer`, `correct_option`, or
 * `correct_option_index`. Every other field is correct, so the quiz is fine and
 * only the answer key is named wrong.
 */
describe("coerceCorrectIndex", () => {
  it("leaves a question that already has correct_index alone", () => {
    const q = { ...base, correct_index: 2 };
    expect(coerceCorrectIndex(q)).toBe(q);
  });

  it("resolves a letter answer (the shape GPT-OSS emits most)", () => {
    expect(indexOf(coerceCorrectIndex({ ...base, answer: "B" }))).toBe(1);
    expect(indexOf(coerceCorrectIndex({ ...base, answer: "C)" }))).toBe(2);
    expect(indexOf(coerceCorrectIndex({ ...base, answer: "(D)" }))).toBe(3);
    expect(indexOf(coerceCorrectIndex({ ...base, answer: "a." }))).toBe(0);
  });

  it("resolves an answer that repeats the option text", () => {
    expect(
      indexOf(coerceCorrectIndex({ ...base, correct_option: "Charlie" })),
    ).toBe(2);
    expect(
      indexOf(coerceCorrectIndex({ ...base, correct_answer: " Bravo " })),
    ).toBe(1);
  });

  it("resolves a numeric alias as the 0-based index the schema asked for", () => {
    expect(
      indexOf(coerceCorrectIndex({ ...base, correct_option_index: 1 })),
    ).toBe(1);
    expect(indexOf(coerceCorrectIndex({ ...base, answer_index: "3" }))).toBe(3);
  });

  it("reads a number equal to the option count as 1-based", () => {
    // 4 options, so index 4 cannot be 0-based; the only coherent reading is the
    // 4th option. Any in-range value stays 0-based.
    expect(indexOf(coerceCorrectIndex({ ...base, answer_index: 4 }))).toBe(3);
  });

  it("prefers exact option text over a letter reading", () => {
    // Options that are themselves labelled: "B" must not beat an exact match.
    const labelled = ["A) one", "B) two", "C) three"];
    expect(
      indexOf(
        coerceCorrectIndex({
          ...base,
          options: labelled,
          answer: "C) three",
        }),
      ),
    ).toBe(2);
  });

  it("leaves the question unchanged when nothing resolves", () => {
    const vague = { ...base, answer: "the second one" };
    expect(indexOf(coerceCorrectIndex(vague))).toBeUndefined();
    expect(
      indexOf(coerceCorrectIndex({ ...base, answer: "Z" })),
    ).toBeUndefined();
    expect(coerceCorrectIndex(null)).toBeNull();
    expect(coerceCorrectIndex("nope")).toBe("nope");
  });
});

describe("repairQuiz with a mis-named answer field", () => {
  it("repairs the exact payload GPT-OSS 120B produced in production", () => {
    const raw = {
      quiz_title: "The Tempest & Disability Theory",
      questions: [
        {
          question: "Caliban is often read through a disability lens as?",
          options: [
            "A) The noble savage whose body is merely different",
            "B) A physically disabled 'other' whose marginalization reflects societal attitudes",
            "C) A purely comic character",
            "D) A symbol of pure evil",
          ],
          answer: "B",
          explanation: "Disability scholars read Caliban's otherness this way.",
        },
        {
          question: "The social model of disability argues that:",
          options: [
            "Disability is purely medical.",
            "Societal barriers, not impairments, disable people.",
          ],
          correct_option: "Societal barriers, not impairments, disable people.",
          explanation: "That is the social model.",
        },
      ],
    };
    const repaired = repairQuiz(raw);
    expect(repaired?.questions.map((q) => q.correct_index)).toEqual([1, 1]);
    expect(repaired?.quiz_title).toBe("The Tempest & Disability Theory");
  });

  it("still drops a question whose answer field cannot be resolved", () => {
    const repaired = repairQuiz({
      quiz_title: "T",
      questions: [
        { ...base, answer: "somewhere in the middle" },
        { ...base, answer: "A" },
      ],
    });
    expect(repaired?.questions).toHaveLength(1);
    expect(repaired?.questions[0]?.correct_index).toBe(0);
  });
});
