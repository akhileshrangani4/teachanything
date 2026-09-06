import { z } from "zod";
import type { Quiz } from "./schema";

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
 * The interactive quiz widget's per-attempt local state: which question is
 * showing, the option index chosen per question (null until picked), and
 * whether the attempt is finished.
 */
export interface QuizWidgetState {
  currentIndex: number;
  selected: (number | null)[];
  finished: boolean;
}

/**
 * Seed the interactive widget's local state on mount. When the student has
 * already completed at least one attempt (persisted server-side and rehydrated
 * into the `attempts` prop by the parent), restore the finished/score view from
 * the most recent attempt. This makes the widget resilient to a remount that
 * keeps the surrounding chat mounted -- most notably the embed widget, which
 * unmounts its chat subtree (`return null`) when hidden on a tab switch and
 * remounts on reopen. Without this the local `useState` reseeds to question 1,
 * throwing away a finished quiz. With no valid prior attempt, start fresh.
 */
export function initialQuizWidgetState(
  total: number,
  attempts: QuizResponse[] | undefined,
): QuizWidgetState {
  const last =
    attempts && attempts.length > 0 ? attempts[attempts.length - 1] : undefined;
  // Only restore when the stored answers line up with this quiz (they always
  // should -- same quiz, same toolCallId -- but a mismatch would mis-score the
  // finished view, so fall back to a fresh start instead).
  if (last && last.answers.length === total) {
    return {
      currentIndex: Math.max(0, total - 1),
      selected: [...last.answers],
      finished: true,
    };
  }
  return {
    currentIndex: 0,
    selected: Array(total).fill(null),
    finished: false,
  };
}

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
