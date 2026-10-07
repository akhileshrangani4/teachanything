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
 * What the primary stream's chunks said about how the turn ended, filled in by
 * `recordTurnChunk` as the chunks are written.
 */
export type StreamTail = {
  /** The first `error` chunk's text, held back from the client. */
  errorText?: string;
  /**
   * An error arrived after the last step had finished: the step that failed
   * never started streaming (its request was rejected), so it is not recorded.
   */
  errorAfterLastStep: boolean;
  /** Text the most recent step streamed. */
  stepText: string;
  /** The most recent step began a retrieval call (`done` aside). */
  stepStartedSearch: boolean;
  /** The most recent step reached `finish-step`. */
  stepFinished: boolean;
};

export function newStreamTail(): StreamTail {
  return {
    errorAfterLastStep: false,
    stepText: "",
    stepStartedSearch: false,
    stepFinished: true,
  };
}

/**
 * Record `chunk` in `tail` on its way to the client, and say whether to write
 * it: `error` chunks are held back.
 *
 * The browser's chat client stops reading the stream at the first `error`
 * chunk, so anything written after it -- the fallback answer, the finish chunk
 * that carries sources -- never renders. A provider failure midway through the
 * agentic loop used to leave the student with just the model's "Let me
 * search..." preamble and an error toast. Holding the error lets the caller
 * try the fallback turn first and write the error only when nothing recovers.
 *
 * The step bookkeeping is what tells a failure that ended the turn from one the
 * loop got past, and whether the step that failed had begun another search.
 * Tool calls a step never finished writing appear nowhere else: a provider
 * emits the call only once its arguments are complete. Call this at the point
 * of writing, after every transform: text a transform was still buffering when
 * the stream failed never reached the student, and must not count as written.
 */
export function recordTurnChunk(
  tail: StreamTail,
  chunk: InferUIMessageChunk<StudyUIMessage>,
): boolean {
  switch (chunk.type) {
    case "start-step":
      tail.stepText = "";
      tail.stepStartedSearch = false;
      tail.stepFinished = false;
      tail.errorAfterLastStep = false;
      break;
    case "text-delta":
      tail.stepText += chunk.delta;
      break;
    case "tool-input-start":
    case "tool-input-available":
      if (isRetrievalToolName(chunk.toolName) && chunk.toolName !== "done") {
        tail.stepStartedSearch = true;
      }
      break;
    case "finish-step":
      tail.stepFinished = true;
      break;
    case "error":
      tail.errorText ??= chunk.errorText;
      if (tail.stepFinished) tail.errorAfterLastStep = true;
      return false;
  }
  return true;
}
