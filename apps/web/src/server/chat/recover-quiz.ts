import type { InferUIMessageChunk } from "ai";
import { nanoid } from "nanoid";
import { parseQuizFromText } from "@/lib/quiz";
import type { StudyUIMessage } from "./study-tools";

type Chunk = InferUIMessageChunk<StudyUIMessage>;

type BlockClass = "prose" | "quiz-candidate" | "pending";

/**
 * Classify a (possibly partial) text block by its opening characters, to decide
 * whether to hold it as a possible leaked quiz or let it stream through live:
 *
 * - starts with `{`                     -> quiz-candidate (bare JSON tool-call leak)
 * - opens a ```json or bare ``` fence   -> quiz-candidate
 * - opens a ```<lang> fence (js, py...) -> prose (real code -- must stream live)
 * - any other non-whitespace char       -> prose
 * - only whitespace, or a fence whose info-line hasn't arrived -> pending
 *
 * Fence classification waits for the info-line (up to the first newline) rather
 * than matching the first character, so a fence streamed as "```" then "json"
 * isn't misread as prose before its language tag arrives -- and, conversely, a
 * ```js block is only buffered until its newline, then released to stream live.
 */
function classifyBlock(text: string): BlockClass {
  const trimmed = text.replace(/^\s+/, "");
  if (trimmed.length === 0) return "pending";
  if (trimmed[0] === "{") return "quiz-candidate";
  if (trimmed[0] !== "`") return "prose";
  const newline = trimmed.indexOf("\n");
  if (newline === -1) return "pending"; // fence info-line not complete yet
  const info = trimmed.slice(0, newline).replace(/`/g, "").trim().toLowerCase();
  return info === "" || info === "json" ? "quiz-candidate" : "prose";
}

/**
 * Recover a quiz a model emitted as a text JSON blob instead of a native
 * `showQuiz` tool call.
 *
 * Some otherwise tool-capable models (varies by model/provider) serialize the
 * tool call into the assistant *text* channel, so the AI SDK forms no
 * `tool-showQuiz` part and the raw `{"quiz_title":...}` JSON renders as prose.
 * This transform holds a text block ONLY while it looks like it could be that
 * JSON (see `classifyBlock`: a leading `{`, or a ```json / bare ``` fence). If
 * the held block parses to a renderable quiz it is dropped and replaced with a
 * synthetic `tool-input-available` chunk -- identical to a native call, so it
 * renders as the interactive widget and persists like one. Otherwise the held
 * chunks are flushed unchanged.
 *
 * Ordinary prose -- and code blocks in other languages (```js, ```python) --
 * stream through live; only quiz-shaped output is buffered, so normal answers
 * keep their token-by-token streaming.
 */
export function recoverLeakedQuiz(): TransformStream<Chunk, Chunk> {
  let holding = false;
  // Whether the held block has been classified yet (prose vs quiz-candidate).
  let classified = false;
  let heldChunks: Chunk[] = [];
  let heldText = "";
  let heldId: string | null = null;

  const reset = () => {
    holding = false;
    classified = false;
    heldChunks = [];
    heldText = "";
    heldId = null;
  };

  const flush = (controller: TransformStreamDefaultController<Chunk>) => {
    for (const c of heldChunks) controller.enqueue(c);
    reset();
  };

  return new TransformStream<Chunk, Chunk>({
    transform(chunk, controller) {
      if (chunk.type === "text-start") {
        // A new text block starts; flush any still-held block first (defensive --
        // a well-formed stream closes a block before opening the next).
        if (holding) flush(controller);
        holding = true;
        classified = false;
        heldChunks = [chunk];
        heldText = "";
        heldId = chunk.id;
        return;
      }

      if (holding && chunk.type === "text-delta" && chunk.id === heldId) {
        heldChunks.push(chunk);
        heldText += chunk.delta;
        if (!classified) {
          const decision = classifyBlock(heldText);
          if (decision === "prose") {
            // Release the held chunks and stop holding so the rest of the block
            // streams through live.
            classified = true;
            flush(controller);
          } else if (decision === "quiz-candidate") {
            // Keep holding until text-end, then try to recover a quiz.
            classified = true;
          }
          // "pending": not enough text to decide yet -- keep buffering.
        }
        return;
      }

      if (holding && chunk.type === "text-end" && chunk.id === heldId) {
        heldChunks.push(chunk);
        const quiz = parseQuizFromText(heldText);
        if (quiz) {
          // Drop the JSON text; emit a native-looking tool call in its place.
          reset();
          controller.enqueue({
            type: "tool-input-available",
            toolCallId: nanoid(),
            toolName: "showQuiz",
            input: quiz,
          } as Chunk);
        } else {
          flush(controller);
        }
        return;
      }

      // Any other chunk (tool parts, a delta for a different id, etc.). If a
      // block is still held, flush it first to preserve ordering.
      if (holding) flush(controller);
      controller.enqueue(chunk);
    },
    flush(controller) {
      if (holding) flush(controller);
    },
  });
}
