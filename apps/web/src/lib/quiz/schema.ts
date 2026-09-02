import { z } from "zod";
import { mcQuestionSchema, type MCQuestion } from "@/lib/questions";

/** Most questions a quiz may carry. Also the ceiling `repairQuiz` trims to. */
export const MAX_QUIZ_QUESTIONS = 5;

/** Longest quiz title. See the note on `quizSchema.quiz_title`. */
export const MAX_QUIZ_TITLE_LENGTH = 200;

/**
 * A multiple-choice quiz rendered as an interactive widget. Used as the
 * `inputSchema` of the `showQuiz` tool, so the model fills this in directly.
 */
export const quizSchema = z.object({
  // Bounded: the title is echoed into the professor dashboard, exports, and
  // (sanitized) the model results note, so an unbounded student-steerable
  // string is both a UI and prompt-size hazard.
  quiz_title: z.string().min(1).max(MAX_QUIZ_TITLE_LENGTH),
  questions: z.array(mcQuestionSchema).min(1).max(MAX_QUIZ_QUESTIONS),
});

export type QuizQuestion = MCQuestion;
export type Quiz = z.infer<typeof quizSchema>;
