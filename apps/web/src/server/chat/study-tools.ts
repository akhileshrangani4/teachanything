import { tool } from "ai";
import type { UIMessage, InferUITools, UIDataTypes } from "ai";
import { quizSchema } from "@/lib/quiz";

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

/** Appended to the chatbot's system prompt so the model knows the tools exist. */
export const STUDY_TOOLS_SYSTEM_ADDENDUM = `

You can render interactive study tools. When the student asks to be quizzed on a topic, call the \`showQuiz\` tool and fill it with well-formed questions based on the course material above - do not write the quiz out as prose. If the student is only asking a question, answer normally without calling a tool.`;

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
