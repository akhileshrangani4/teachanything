import { z } from "zod";

/**
 * The correct answer is the 0-based INDEX into `options`, not the answer string.
 *
 * A `correct_answer must be one of the options` cross-field check can only be a
 * zod refinement, and refinements are stripped from the JSON schema the model
 * receives for the `showQuiz` tool -- so the model never sees the constraint,
 * routinely emits a mismatch, and the SDK then rejects the tool input at
 * validation time (an `output-error` quiz that shows the student an error with
 * no answer). Expressing the answer as an integer index makes the constraint
 * structural: it survives into the model-facing JSON schema, and any in-range
 * (or even out-of-range) integer is a structurally valid tool call, so this
 * whole class of validation failures disappears. `QuizMessage` compares by
 * index and defensively ignores an out-of-range value.
 */
export const mcQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(4),
  correct_index: z
    .number()
    .int()
    .min(0)
    .describe("0-based index into `options` of the correct choice"),
  explanation: z.string().min(1),
});

export type MCQuestion = z.infer<typeof mcQuestionSchema>;

/**
 * Field names models reach for instead of `correct_index`, most specific first.
 * Measured against the live registry on 2026-08-17: five of the six models emit
 * `correct_index` as instructed, but GPT-OSS 120B never does. Across six runs it
 * used `answer: "B"` (three times), `correct_option: "<full option text>"`, and
 * `correct_option_index: 1` -- every other field was correct, so the quiz was
 * fine and only the answer key was named wrong.
 */
const ANSWER_ALIASES = [
  "correct_index",
  "correct_option_index",
  "answer_index",
  "correctIndex",
  "correct_option",
  "correct_answer",
  "answer",
] as const;

/**
 * Resolve an alias's value to an option index, or null when it can't be pinned
 * down. Only unambiguous readings are accepted:
 *
 * - a number is taken as the 0-based index the schema asked for, except when it
 *   is exactly `options.length`, which can only have been 1-based
 * - a string matching an option exactly is that option
 * - a bare letter label ("B", "B)", "(B)", "B.") is its position in the alphabet
 */
function resolveAnswerIndex(value: unknown, options: unknown[]): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value === options.length && value > 0 ? value - 1 : value;
  }
  if (typeof value !== "string") return null;
  const answer = value.trim();
  if (answer.length === 0) return null;

  const exact = options.findIndex(
    (option) => typeof option === "string" && option.trim() === answer,
  );
  if (exact !== -1) return exact;

  if (/^\d+$/.test(answer)) {
    const parsed = Number(answer);
    return parsed === options.length && parsed > 0 ? parsed - 1 : parsed;
  }

  const letter = answer.match(/^\(?([A-Za-z])[).:]?$/);
  if (letter?.[1]) {
    const index = letter[1].toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
    if (index >= 0 && index < options.length) return index;
  }
  return null;
}

/**
 * Fill in `correct_index` from whichever answer field the model actually used.
 * Returns the question unchanged when it already has one, or when no alias
 * resolves -- the caller still validates, so an unresolvable question is dropped
 * rather than guessed at.
 */
export function coerceCorrectIndex(question: unknown): unknown {
  if (typeof question !== "object" || question === null) return question;
  const q = question as Record<string, unknown>;
  if (typeof q.correct_index === "number") return question;

  const options = Array.isArray(q.options) ? q.options : [];
  for (const alias of ANSWER_ALIASES) {
    if (!(alias in q)) continue;
    const index = resolveAnswerIndex(q[alias], options);
    if (index !== null) return { ...q, correct_index: index };
  }
  return question;
}
