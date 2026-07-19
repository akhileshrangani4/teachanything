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
