import type { InferUIMessageChunk } from "ai";
import { isRetrievalToolName } from "@/lib/retrieval-tool-names";
import type { StudyUIMessage } from "./study-tools";

/**
 * Filter retrieval-tool RESULT chunks out of a UI message stream while letting
 * tool *inputs* (status-line data) and every other chunk through. Output chunks
 * carry only `toolCallId`, so retrieval call ids are tracked at
 * `tool-input-start` (which carries the tool name).
 */
export function stripRetrievalOutputs(): TransformStream<
  InferUIMessageChunk<StudyUIMessage>,
  InferUIMessageChunk<StudyUIMessage>
> {
  const retrievalCallIds = new Set<string>();
  return new TransformStream({
    transform(chunk, controller) {
      // Register retrieval call ids from EVERY input chunk that carries a tool
      // name. Providers that return tool calls atomically (no streamed args)
      // emit `tool-input-available` with no preceding `tool-input-start`, so
      // tracking only the latter would let their output chunk slip through --
      // a raw-document-chunk leak on public bots. All three input variants
      // carry `toolName`.
      if (
        (chunk.type === "tool-input-start" ||
          chunk.type === "tool-input-available" ||
          chunk.type === "tool-input-error") &&
        isRetrievalToolName(chunk.toolName)
      ) {
        retrievalCallIds.add(chunk.toolCallId);
      }
      const isRetrievalOutput =
        (chunk.type === "tool-output-available" ||
          chunk.type === "tool-output-error") &&
        retrievalCallIds.has(chunk.toolCallId);
      if (!isRetrievalOutput) controller.enqueue(chunk);
    },
  });
}

/**
 * Hold `error` chunks back from the client, recording the first one's text in
 * `held` instead.
 *
 * The browser's chat client stops reading the stream at the first `error`
 * chunk, so anything written after it -- the fallback answer, the finish chunk
 * that carries sources -- never renders. A provider failure midway through the
 * agentic loop used to leave the student with just the model's "Let me
 * search..." preamble and an error toast. Holding the error lets the caller
 * try the fallback turn first and write the error only when nothing recovers.
 */
export function holdErrors(held: {
  errorText?: string;
}): TransformStream<
  InferUIMessageChunk<StudyUIMessage>,
  InferUIMessageChunk<StudyUIMessage>
> {
  return new TransformStream({
    transform(chunk, controller) {
      if (chunk.type !== "error") {
        controller.enqueue(chunk);
        return;
      }
      held.errorText ??= chunk.errorText;
    },
  });
}
