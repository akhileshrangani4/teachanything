import type { UIMessageStreamWriter } from "ai";
import type { StudyUIMessage } from "./study-tools";

/**
 * Where a chat turn's wall-clock time goes, persisted on the assistant message
 * as `metadata.timing`. All values are milliseconds.
 *
 * `responseTime` (kept as-is, the professor dashboard averages it) starts
 * when streaming starts, so it never included the up-front retrieval that
 * runs before it. In Sep 2026 that hid an ~11 s trigram query from every
 * latency number we had. `totalMs` is the full server-side turn.
 */
export type TurnTiming = {
  /** streamChat entry to stream start: conversation, history, RAG, prompts. */
  preStreamMs: number;
  /** fetchTurnContext: history, RAG context and study responses, in parallel. */
  contextMs: number;
  /** Query embedding API call. Absent when the chatbot has no files. */
  embeddingMs?: number;
  /** Up-front hybrid search. Absent when there was nothing to search. */
  searchMs?: number;
  /** Stream start to the first answer text: what the student waits through. */
  firstTokenMs?: number;
  /** streamChat entry to the end of the turn. */
  totalMs: number;
};

/** Filled in by buildRAGContext as each step finishes. */
export type RagTiming = {
  embeddingMs?: number;
  searchMs?: number;
};

/**
 * Wraps the stream writer so `onFirstText` fires once, on the first non-empty
 * text delta. Every answer path (primary, done-answer, fallback) writes through
 * `write`, so one wrapper covers them all.
 */
export function withFirstTextTimer(
  writer: UIMessageStreamWriter<StudyUIMessage>,
  onFirstText: () => void,
): UIMessageStreamWriter<StudyUIMessage> {
  let seen = false;
  return {
    write(part) {
      if (!seen && part.type === "text-delta" && part.delta.length > 0) {
        seen = true;
        onFirstText();
      }
      writer.write(part);
    },
    merge: (stream) => writer.merge(stream),
    get onError() {
      return writer.onError;
    },
  };
}
