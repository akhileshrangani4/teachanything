import { coerceCorrectIndex, mcQuestionSchema } from "@/lib/questions";
import type { Quiz } from "./schema";
import {
  MAX_QUIZ_QUESTIONS,
  MAX_QUIZ_TITLE_LENGTH,
  quizSchema,
} from "./schema";
import { isRenderableQuiz } from "./is-renderable";
import { jsonCandidate, salvageTruncatedQuiz } from "./text-extraction";

/**
 * Coerce whatever the model produced into a renderable quiz, dropping the parts
 * that can't render, or null when nothing usable is left.
 *
 * Tool input reaches us in three broken shapes, and all three currently show the
 * student "Couldn't build the quiz" even when most of the quiz is fine:
 *
 * - more questions than the schema allows (trimmed to `MAX_QUIZ_QUESTIONS`)
 * - individual malformed questions: missing explanation, too many options, a
 *   `correct_index` past the last option (dropped, the rest kept)
 * - input cut off mid-write by the token limit (see `salvageTruncatedQuiz`),
 *   arriving either as an unparseable string or as accumulated partial text
 *
 * A quiz that is already valid passes through unchanged, so callers can use this
 * as the single "can the client render this?" predicate.
 */
export function repairQuiz(input: unknown): Quiz | null {
  const candidate =
    typeof input === "string"
      ? (jsonCandidate(input) ?? salvageTruncatedQuiz(input))
      : input;
  if (typeof candidate !== "object" || candidate === null) return null;

  const { quiz_title: title, questions } = candidate as {
    quiz_title?: unknown;
    questions?: unknown;
  };
  if (typeof title !== "string" || title.trim().length === 0) return null;
  if (!Array.isArray(questions)) return null;

  const usable = questions
    // Models routinely name the answer field something other than
    // `correct_index`; fill it in before validating (see coerceCorrectIndex).
    .map(coerceCorrectIndex)
    .map((question) => mcQuestionSchema.safeParse(question))
    .filter(
      (parsed) =>
        parsed.success &&
        parsed.data.correct_index < parsed.data.options.length,
    )
    .map((parsed) => parsed.data)
    .slice(0, MAX_QUIZ_QUESTIONS);
  if (usable.length === 0) return null;

  const result = quizSchema.safeParse({
    quiz_title: title.slice(0, MAX_QUIZ_TITLE_LENGTH),
    questions: usable,
  });
  return result.success && isRenderableQuiz(result.data) ? result.data : null;
}
