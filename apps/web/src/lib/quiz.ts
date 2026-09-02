/**
 * Quiz domain: schema, model-output repair/recovery, and attempt grading.
 * Implementation lives in focused modules under `lib/quiz/`; this file is the
 * public entry point so `@/lib/quiz` imports keep working unchanged.
 */
export {
  MAX_QUIZ_QUESTIONS,
  MAX_QUIZ_TITLE_LENGTH,
  quizSchema,
} from "./quiz/schema";
export type { Quiz, QuizQuestion } from "./quiz/schema";
export { isRenderableQuiz } from "./quiz/is-renderable";
export { repairQuiz } from "./quiz/repair";
export { parseQuizFromText } from "./quiz/parse-from-text";
export { quizResponseSchema } from "./quiz/response";
export type { QuizResponse, QuizWidgetState } from "./quiz/response";
export {
  initialQuizWidgetState,
  isValidQuizAnswers,
  gradeQuiz,
} from "./quiz/response";
