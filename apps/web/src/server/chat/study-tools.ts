import { tool } from "ai";
import type { UIMessage, InferUITools, UIDataTypes } from "ai";
import { quizSchema, repairQuiz, MAX_QUIZ_QUESTIONS } from "@/lib/quiz";

/**
 * Render-only study tools. Each tool's `inputSchema` IS the widget payload;
 * omitting `execute` means the model's tool call resolves to an
 * `input-available` part that the client renders directly - no server
 * execution, no tool-result round-trip, and the run ends after the call.
 *
 * Phase 1 ships `showQuiz`; flashcards/test/mindmap/matching follow in Phase 2.
 */
export const studyTools = {
  showQuiz: tool({
    description:
      "Render an interactive multiple-choice quiz. Call this when the student " +
      "asks to be quizzed or tested informally on a topic. Base questions on " +
      "the provided course material when available.",
    inputSchema: quizSchema,
  }),
} as const;

/** Rough output cost of one generated question: 4 options plus an explanation. */
const TOKENS_PER_QUESTION = 150;

/** Output tokens to leave for the quiz title and JSON scaffolding. */
const QUIZ_OVERHEAD_TOKENS = 120;

/**
 * How many questions actually fit in a turn's output budget.
 *
 * A chatbot's `maxTokens` caps the whole reply, tool input included, so a
 * professor who set a small limit gets a quiz that stops mid-question: the input
 * then fails validation and the student sees an error. The model can't know the
 * limit, so tell it. `repairQuiz` still salvages a quiz that overruns anyway --
 * this just stops most of them from overrunning in the first place.
 */
export function maxQuestionsForBudget(maxOutputTokens: number): number {
  const affordable = Math.floor(
    (maxOutputTokens - QUIZ_OVERHEAD_TOKENS) / TOKENS_PER_QUESTION,
  );
  return Math.min(MAX_QUIZ_QUESTIONS, Math.max(1, affordable));
}

/**
 * Appended to the chatbot's system prompt so the model knows the tools exist.
 *
 * `canSearch` mirrors the retrieval-tool gate in `streamChat`: only promise the
 * model a search when `search_documents` is actually in its toolset.
 *
 * The scoping sentence matters as much as the tool instruction. Without it this
 * addendum's "based on the course material above" was the last thing in the
 * system prompt, and it pointed the model at whatever the initial RAG query
 * happened to retrieve -- so a student who asked to be quizzed on one named
 * chapter got questions drawn from across the whole corpus instead.
 */
export function buildStudyToolsAddendum(
  maxOutputTokens: number,
  canSearch: boolean,
): string {
  const maxQuestions = maxQuestionsForBudget(maxOutputTokens);
  const scoping = canSearch
    ? " If the passages above do not cover what they named, search the documents for it before writing any questions."
    : "";
  return `

You can render interactive study tools. When the student asks to be quizzed on a topic, call the \`showQuiz\` tool and fill it with well-formed questions based on the course material above - do not write the quiz out as prose. Scope the quiz to exactly what the student asked for: when they name a chapter, section, reading, topic, or text, every question must come from that material, and material outside it must be left out no matter how relevant it seems.${scoping} Keep the quiz to at most ${maxQuestions} ${maxQuestions === 1 ? "question" : "questions"}, each with up to 4 options and a one- or two-sentence explanation, so the whole quiz fits within this chatbot's reply limit. If the student is only asking a question, answer normally without calling a tool.`;
}

/**
 * True if a `showQuiz` call in `toolCalls` will actually render for the student,
 * either as the model wrote it or after `repairQuiz` drops the unusable parts
 * (too many questions, a malformed question, input cut off by the token limit).
 *
 * This gates the empty-response fallback, so it has to agree with what the
 * client ends up showing: `repairQuizToolParts` runs the same pure `repairQuiz`
 * over the same input on its way to the browser, so the two decisions cannot
 * disagree. A call that survives neither path renders as an error notice and
 * must NOT count as a visible answer, or the fallback is suppressed and the
 * student is left with the error and no answer at all.
 */
export function producedRenderableQuiz(
  toolCalls: ReadonlyArray<{
    toolName: string;
    invalid?: boolean;
    input?: unknown;
  }>,
): boolean {
  return toolCalls.some(
    (tc) => tc.toolName === "showQuiz" && repairQuiz(tc.input) !== null,
  );
}

export type StudyTools = InferUITools<typeof studyTools>;

/** Custom per-message metadata streamed via `toUIMessageStreamResponse`. */
export type StudyMessageMetadata = {
  sources?: Array<{ fileName: string; chunkIndex: number; similarity: number }>;
  responseTime?: number;
  truncated?: boolean;
};

/** A UIMessage typed with our tools - makes `part.input` typed as `Quiz`. */
export type StudyUIMessage = UIMessage<
  StudyMessageMetadata,
  UIDataTypes,
  StudyTools
>;
