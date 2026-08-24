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
   *
   * `shownInput` is the tool input the student answered, passed so a summary can
   * name what was actually missed rather than only a score. `detailed` asks for
   * that longer form; callers pass it for the most recent attempt only, since
   * every attempt lands in the system prompt of every later turn.
   */
  summarizeResponseForModel(
    response: unknown,
    shownInput?: unknown,
    detailed?: boolean,
  ): string;
  /**
   * Optional human label derived from the shown input (e.g. a quiz title), used
   * in the model results note. Falls back to the tool name.
   */
  labelForModel?(shownInput: unknown): string | undefined;
}

/**
 * Cap one question/option echoed into the model note. Model-generated and
 * student-steerable text lands in the system prompt of every later turn, so it
 * is collapsed to one line and bounded, same reasoning as `labelForModel`.
 */
function clip(text: unknown, max = 80): string {
  if (typeof text !== "string") return "?";
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`;
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
  summarizeResponseForModel(response, shownInput, detailed) {
    // Null-safe: the handler always stores an object today, but this reads a
    // raw jsonb column -- a throw here would take down the whole chat turn.
    const r = (response ?? {}) as {
      score?: unknown;
      total?: unknown;
      answers?: unknown;
    };
    const score = typeof r.score === "number" ? r.score : "?";
    const total = typeof r.total === "number" ? r.total : "?";
    const summary = `scored ${score}/${total}`;
    if (!detailed) return summary;

    // Name what the student actually got wrong, so the model can review those
    // questions instead of answering "I don't know what you picked". Only the
    // misses are listed: the correct ones need no remediation and every
    // character here rides in the system prompt of every later turn.
    const quiz = quizSchema.safeParse(shownInput);
    const answers = r.answers;
    if (!quiz.success || !Array.isArray(answers)) return summary;

    const misses = quiz.data.questions
      .map((question, i) => ({ question, chosen: answers[i], index: i }))
      .filter(
        ({ question, chosen }) =>
          typeof chosen === "number" && chosen !== question.correct_index,
      )
      .map(({ question, chosen, index }) => {
        const picked = question.options[chosen as number];
        const right = question.options[question.correct_index];
        return `Q${index + 1} "${clip(question.question)}" (they chose "${clip(picked)}", correct was "${clip(right)}")`;
      });

    return misses.length === 0
      ? summary
      : `${summary}; missed ${misses.join("; ")}`;
  },
  labelForModel(shownInput) {
    const title = (shownInput as { quiz_title?: unknown } | null)?.quiz_title;
    if (typeof title !== "string" || !title.trim()) return "quiz";
    // The title is model-generated but student-steerable ("make a quiz titled
    // ..."), and this string lands in the SYSTEM prompt on every later turn.
    // Collapse newlines/whitespace (so it can't break out of its list-item
    // framing to fake system-level instructions) and cap the length.
    const sanitized = title.replace(/\s+/g, " ").trim().slice(0, 120);
    return `"${sanitized}" quiz`;
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
