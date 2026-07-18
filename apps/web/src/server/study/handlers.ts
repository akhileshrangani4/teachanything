import {
  quizSchema,
  isValidQuizAnswers,
  gradeQuiz,
  type QuizResponse,
} from "@/lib/quiz";
import { StudyRequestError } from "./errors";

/**
 * A study tool's server-side response handler. Given the tool input that was
 * SHOWN to the student (the persisted `input` of its `tool-<name>` part) and the
 * raw response the client submitted, validate it and return the object to store
 * in `study_tool_responses.response`. Throw `StudyRequestError` on anything
 * invalid. Scores/derived fields are computed here, never trusted from the
 * client.
 *
 * To add a new study component (flashcards, test, mindmap, ...): register its
 * handler here keyed by its tool name. Nothing else in the capture pipeline
 * (endpoint, conversation/ownership checks, attempt numbering, persistence) is
 * tool-specific.
 */
export interface StudyToolHandler {
  buildResponse(shownInput: unknown, clientResponse: unknown): unknown;
  /**
   * One-line summary of a single stored response for the model, e.g.
   * "scored 3/5". Used to tell the model how the student did so it can react.
   */
  summarizeResponseForModel(response: unknown): string;
  /**
   * Optional human label derived from the shown input (e.g. a quiz title), used
   * in the model results note. Falls back to the tool name.
   */
  labelForModel?(shownInput: unknown): string | undefined;
}

const quizHandler: StudyToolHandler = {
  buildResponse(shownInput, clientResponse): QuizResponse {
    const quiz = quizSchema.safeParse(shownInput);
    if (!quiz.success) {
      throw new StudyRequestError("Quiz not found for this conversation", 404);
    }
    const answers = (clientResponse as { answers?: unknown } | null)?.answers;
    if (
      !Array.isArray(answers) ||
      !answers.every((a) => Number.isInteger(a)) ||
      !isValidQuizAnswers(quiz.data, answers as number[])
    ) {
      throw new StudyRequestError("Answers do not match the quiz", 400);
    }
    return gradeQuiz(quiz.data, answers as number[]);
  },
  summarizeResponseForModel(response) {
    const r = response as { score?: unknown; total?: unknown };
    const score = typeof r.score === "number" ? r.score : "?";
    const total = typeof r.total === "number" ? r.total : "?";
    return `scored ${score}/${total}`;
  },
  labelForModel(shownInput) {
    const title = (shownInput as { quiz_title?: unknown } | null)?.quiz_title;
    return typeof title === "string" && title.trim()
      ? `"${title}" quiz`
      : "quiz";
  },
};

/** Registered study-tool handlers, keyed by tool name (the `showX` tool). */
export const STUDY_TOOL_HANDLERS: Record<string, StudyToolHandler> = {
  showQuiz: quizHandler,
};

/** Tool names that accept a persisted student response. */
export function isSupportedStudyTool(toolName: string): boolean {
  return toolName in STUDY_TOOL_HANDLERS;
}
