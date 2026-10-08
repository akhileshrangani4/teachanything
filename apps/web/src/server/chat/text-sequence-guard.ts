import { logWarn } from "@/lib/logger";
import type { Chunk } from "./ui-chunks";

/**
 * Last stop before chunks reach the writer: make every `text-delta` and
 * `text-end` refer to a text part the AI SDK still has open.
 *
 * The SDK throws on a delta or end for a part it does not know ("Received
 * text-end for missing text part"), and that throw happens while it assembles
 * the response message, outside anything `runPrimaryTurn` can catch. The turn
 * dies with only what streamed so far and no error recorded. A provider that
 * orders its chunks differently from what our transforms expect is enough to
 * trigger it. DeepSeek V3.2 (via OpenRouter) sends a text block's `text-end`
 * after a tool call, by which point `recoverLeakedQuiz` has already closed the
 * block, and that cut its turns off after "Let me search...". So this repairs
 * the sequence instead: an orphaned end is dropped, an orphaned delta gets the
 * start it was missing (its text is kept as a new part), and a part opened
 * twice is closed before it reopens, since the SDK would otherwise leave the
 * first copy streaming forever. Each repair is logged so a new model's ordering
 * shows up in the logs rather than as a stuck reply.
 *
 * Reasoning chunks are not guarded: every turn streams with
 * `sendReasoning: false`.
 */
export function guardTextSequence(logContext: {
  chatbotId: string;
}): TransformStream<Chunk, Chunk> {
  // Mirrors the SDK's `activeTextParts`, which `finish-step` also resets.
  const open = new Set<string>();
  return new TransformStream({
    transform(chunk, controller) {
      switch (chunk.type) {
        case "text-start":
          if (open.has(chunk.id)) {
            logWarn("Closed a text part the provider opened again", {
              ...logContext,
              partId: chunk.id,
            });
            controller.enqueue({ type: "text-end", id: chunk.id });
          }
          open.add(chunk.id);
          break;
        case "text-delta":
          if (!open.has(chunk.id)) {
            logWarn("Opened a text part for an orphaned text-delta", {
              ...logContext,
              partId: chunk.id,
            });
            controller.enqueue({ type: "text-start", id: chunk.id });
            open.add(chunk.id);
          }
          break;
        case "text-end":
          if (!open.delete(chunk.id)) {
            logWarn("Dropped a text-end for a text part that is not open", {
              ...logContext,
              partId: chunk.id,
            });
            return;
          }
          break;
        case "finish-step":
          open.clear();
          break;
      }
      controller.enqueue(chunk);
    },
  });
}
