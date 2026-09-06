import { isRenderableQuiz, repairQuiz, type Quiz } from "@/lib/quiz";
import type { Chunk } from "./ui-chunks";

/** A chunk that closes out a `showQuiz` input the model never finished. */
export type ClosingQuizChunk =
  | {
      type: "tool-input-available";
      toolCallId: string;
      toolName: "showQuiz";
      input: Quiz;
    }
  | { type: "tool-output-error"; toolCallId: string; errorText: string };

/**
 * Close out every `showQuiz` input that started streaming but never became a
 * tool call, which is what the token limit cutting the model off mid-input looks
 * like: the SDK forms no tool call (nothing lands in `steps`), while the client
 * is left holding a part stuck in `input-streaming` -- the "Building your
 * quiz..." skeleton -- that would spin for the rest of the session.
 *
 * Each one resolves to the questions that finished writing, or to an error when
 * none did, so the skeleton always becomes either a quiz or the notice.
 */
export function closeTruncatedQuizInputs(
  partialInputs: ReadonlyMap<string, string>,
  completedToolCallIds: readonly string[],
): ClosingQuizChunk[] {
  const completed = new Set(completedToolCallIds);
  const closing: ClosingQuizChunk[] = [];
  for (const [toolCallId, partial] of partialInputs) {
    if (completed.has(toolCallId)) continue;
    const quiz = repairQuiz(partial);
    closing.push(
      quiz
        ? {
            type: "tool-input-available",
            toolCallId,
            toolName: "showQuiz",
            input: quiz,
          }
        : {
            type: "tool-output-error",
            toolCallId,
            errorText: "Quiz input was cut off before any question completed",
          },
    );
  }
  return closing;
}

/**
 * Salvage a `showQuiz` tool call the AI SDK rejected, or accepted in a shape the
 * widget can't render, on its way to the browser.
 *
 * A chatbot's `maxTokens` caps the whole turn, so a low setting cuts the quiz off
 * mid-write: the input then fails validation and arrives as `tool-input-error` +
 * `tool-output-error`, which the client renders as "Couldn't build the quiz" even
 * though the questions that finished are fine. The same notice appears when the
 * model writes more questions than the schema allows or botches one question.
 *
 * `repairQuiz` keeps what can render, so those turns become a shorter quiz
 * instead of an error. Two shapes are rewritten:
 *
 * - `tool-input-error` (validation rejected the input) becomes a normal
 *   `tool-input-available` carrying the repaired quiz, and the paired
 *   `tool-output-error` is dropped so the client doesn't flip the part back to
 *   an error state.
 * - `tool-input-available` whose input is structurally valid but unrenderable
 *   (an out-of-range `correct_index`) keeps its chunk, with the repaired input.
 *
 * Input that can't be salvaged passes through untouched and still shows the
 * error notice, and `producedRenderableQuiz` reaches the same verdict from the
 * same `repairQuiz` call, so the server still runs the prose fallback for it.
 */
export function repairQuizToolParts(): TransformStream<Chunk, Chunk> {
  /** Tool call ids whose input error was replaced with a repaired quiz. */
  const repaired = new Set<string>();

  return new TransformStream<Chunk, Chunk>({
    transform(chunk, controller) {
      const part = chunk as {
        type: string;
        toolCallId?: string;
        toolName?: string;
        input?: unknown;
      };

      if (part.type === "tool-input-error" && part.toolName === "showQuiz") {
        const quiz = repairQuiz(part.input);
        if (quiz && part.toolCallId) {
          repaired.add(part.toolCallId);
          controller.enqueue({
            type: "tool-input-available",
            toolCallId: part.toolCallId,
            toolName: "showQuiz",
            input: quiz,
          });
          return;
        }
      }

      // The error that follows a rejected input, for a call we just repaired.
      if (
        part.type === "tool-output-error" &&
        part.toolCallId &&
        repaired.has(part.toolCallId)
      ) {
        repaired.delete(part.toolCallId);
        return;
      }

      if (
        chunk.type === "tool-input-available" &&
        chunk.toolName === "showQuiz" &&
        !isRenderableQuiz(chunk.input as Quiz)
      ) {
        const quiz = repairQuiz(chunk.input);
        if (quiz) {
          controller.enqueue({ ...chunk, input: quiz });
          return;
        }
      }

      controller.enqueue(chunk);
    },
  });
}
