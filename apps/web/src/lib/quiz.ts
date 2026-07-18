import { z } from "zod";
import { mcQuestionSchema, type MCQuestion } from "@/lib/questions";

/**
 * A multiple-choice quiz rendered as an interactive widget. Used as the
 * `inputSchema` of the `showQuiz` tool, so the model fills this in directly.
 */
export const quizSchema = z.object({
  quiz_title: z.string().min(1),
  questions: z.array(mcQuestionSchema).min(1).max(5),
});

export type QuizQuestion = MCQuestion;
export type Quiz = z.infer<typeof quizSchema>;

/**
 * True if every question's `correct_index` points at a real option.
 *
 * The schema can only bound `correct_index >= 0`: an upper bound
 * (`< options.length`) would have to be a cross-field zod refinement, and
 * refinements are stripped from the model-facing JSON schema -- the exact
 * problem the index design avoids. So a model can still emit an out-of-range
 * index; it is structurally valid (the SDK accepts it), but it would render a
 * quiz with no correct option and unwinnable scoring. Callers use this to treat
 * such a quiz as unrenderable (show an error notice + fall back to prose),
 * matching how a schema-invalid quiz is handled.
 */
export function isRenderableQuiz(quiz: Quiz): boolean {
  // Defensive: the server casts a tool-call `input` to `Quiz` before calling
  // this, so guard the shape rather than trusting it (a throw here would break
  // the stream). A valid call always satisfies the schema; anything else is,
  // by definition, not renderable.
  if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    return false;
  }
  return quiz.questions.every(
    (q) =>
      Array.isArray(q?.options) &&
      Number.isInteger(q.correct_index) &&
      q.correct_index >= 0 &&
      q.correct_index < q.options.length,
  );
}

/**
 * A student's completed quiz attempt as stored in `study_tool_responses.response`.
 * `answers[i]` is the 0-based option index the student picked for question `i`,
 * in question order. `score`/`total` are derived server-side from the quiz
 * (never trusted from the client).
 */
export const quizResponseSchema = z.object({
  answers: z.array(z.number().int().min(0)),
  score: z.number().int().min(0),
  total: z.number().int().min(0),
});
export type QuizResponse = z.infer<typeof quizResponseSchema>;

/**
 * True if `answers` is a well-formed set of selections for `quiz`: one entry per
 * question, each a 0-based index into that question's options. Used at the
 * capture boundary before grading/storing.
 */
export function isValidQuizAnswers(quiz: Quiz, answers: number[]): boolean {
  if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
    return false;
  }
  return quiz.questions.every((q, i) => {
    const a = answers[i];
    return (
      Number.isInteger(a) && a !== undefined && a >= 0 && a < q.options.length
    );
  });
}

/**
 * Grade a set of answers against the quiz. Assumes `isValidQuizAnswers` already
 * passed. Score is computed here (server-side) rather than trusting a
 * client-sent value.
 */
export function gradeQuiz(quiz: Quiz, answers: number[]): QuizResponse {
  const total = quiz.questions.length;
  const score = quiz.questions.reduce(
    (acc, q, i) => (answers[i] === q.correct_index ? acc + 1 : acc),
    0,
  );
  return { answers, score, total };
}
