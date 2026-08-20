import type { InferUIMessageChunk } from "ai";
import { nanoid } from "nanoid";
import { parseQuizFromText } from "@/lib/quiz";
import type { StudyUIMessage } from "./study-tools";

type Chunk = InferUIMessageChunk<StudyUIMessage>;

/**
 * Openers that can begin a leaked `showQuiz` call inside assistant text:
 * a bare JSON object, a code fence, or the pseudo-call syntax
 * (`showQuiz(quiz_title=...)`) that Llama-family models emit.
 */
const MARKERS = ["{", "```", "showQuiz("] as const;

/**
 * How much streamed text stays buffered while watching for a marker. A marker
 * can be split across deltas ("[show" + "Quiz("), so the tail that could be an
 * incomplete marker -- one char less than the longest one, counting the `[` a
 * pseudo-call is usually wrapped in -- must not be released yet.
 */
const MARKER_LOOKBACK = "[showQuiz(".length - 1;

/**
 * Hard cap on held text. A 5-question quiz serializes to ~2KB, so anything past
 * this is not the leak we're looking for; bail out rather than withhold an
 * unbounded stretch of a real answer.
 */
const MAX_HELD_CHARS = 8_000;

/**
 * How far past `showQuiz(` to wait for `quiz_title` / `questions` before
 * concluding the text isn't a real call. Generous enough for a pretty-printed
 * call that puts its first arg on the next line.
 */
const PSEUDO_ARG_WINDOW = 48;

/** Index where the earliest leak marker starts in `text`, or -1. */
function findMarker(text: string): number {
  let earliest = -1;
  for (const marker of MARKERS) {
    const at = text.indexOf(marker);
    if (at !== -1 && (earliest === -1 || at < earliest)) earliest = at;
  }
  // A pseudo-call usually arrives bracketed -- `[showQuiz(...)]` -- so include
  // the bracket in the held text instead of stranding it in the prose.
  if (earliest > 0 && text[earliest - 1] === "[") return earliest - 1;
  return earliest;
}

/**
 * Whether held text can still turn out to be a leaked quiz. The markers are
 * deliberately broad, so this bails out of the inevitable false positives as
 * soon as the text rules a quiz out -- a `{` in prose or LaTeX, a ```js code
 * block -- and the rest of that answer goes back to streaming live.
 */
function stillPlausible(held: string): boolean {
  const text = held.replace(/^\s+/, "");
  if (text.length === 0) return true;
  if (text[0] === "{") {
    // A JSON object opens with a quoted key (or closes immediately). Prose like
    // "the set {a, b}" or "\frac{1}{2}" is ruled out at the very next char.
    return /^\{\s*(?:"|\}|$)/.test(text);
  }
  if (text[0] === "`") {
    const newline = text.indexOf("\n");
    // Fence info-line still arriving: keep holding, but not indefinitely.
    if (newline === -1) return text.length <= 20;
    const info = text.slice(0, newline).replace(/`/g, "").trim().toLowerCase();
    return info === "" || info === "json";
  }
  // Pseudo-call: rule it out as soon as the arg list proves it isn't a quiz, so
  // prose that merely mentions `showQuiz()` doesn't buffer the rest of the
  // block. A real call names one of its two args up front; anything that closes
  // its parens, or runs past the window, without naming either is not a call.
  const args = text.slice(text.indexOf("(") + 1);
  if (args.length < PSEUDO_ARG_WINDOW && !args.includes(")")) return true;
  return /quiz_title|questions/.test(args);
}

/**
 * Recover a quiz a model emitted as text instead of a native `showQuiz` tool
 * call.
 *
 * Some otherwise tool-capable models (varies by model/provider) serialize the
 * tool call into the assistant *text* channel, so the AI SDK forms no
 * `tool-showQuiz` part and the raw call renders as prose. The leak can be the
 * whole text block or -- as seen in production -- follow a sentence of preamble
 * ("Here are some quiz questions...") inside the same block, and it can be
 * either JSON or pseudo-call syntax (see `parseQuizFromText`).
 *
 * So this watches each text block for a leak marker, holding back only the few
 * characters that could be an incomplete marker. Once a marker appears, the
 * text from that point is held; if it parses to a renderable quiz the held text
 * is dropped and replaced with a synthetic `tool-input-available` chunk --
 * identical to a native call, so it renders as the interactive widget and
 * persists like one. Any preamble before the marker is kept as text; a held
 * block that turns out not to be a quiz is emitted unchanged.
 *
 * Ordinary prose keeps streaming token by token: text is only withheld from a
 * marker onward, and `stillPlausible` releases it again as soon as the shape
 * rules a quiz out.
 *
 * Accepted limitation: when a block holds a non-quiz JSON blob (or fence) AND a
 * real leak after it, recovery drops everything from the first marker on, so the
 * intervening content is lost with the leak. A quiz turn that also contains an
 * unrelated JSON blob isn't a shape worth the extra state.
 */
export function recoverLeakedQuiz(): TransformStream<Chunk, Chunk> {
  /** null between blocks; otherwise the id of the block being processed. */
  let blockId: string | null = null;
  let startChunk: Chunk | null = null;
  let startEmitted = false;
  /** Chunks of the current block not yet emitted, oldest first. */
  let pending: Chunk[] = [];
  let pendingText = "";
  /** Index in `pendingText` where a leak starts, or -1 while still watching. */
  let markerAt = -1;

  const reset = () => {
    blockId = null;
    startChunk = null;
    startEmitted = false;
    pending = [];
    pendingText = "";
    markerAt = -1;
  };

  const deltaOf = (chunk: Chunk): string =>
    (chunk as { delta?: string }).delta ?? "";

  const emitStart = (controller: TransformStreamDefaultController<Chunk>) => {
    if (startEmitted || !startChunk) return;
    controller.enqueue(startChunk);
    startEmitted = true;
  };

  /** Emit every unemitted chunk of the block exactly as it arrived. */
  const flushPending = (
    controller: TransformStreamDefaultController<Chunk>,
  ) => {
    if (pending.length > 0 || !startEmitted) emitStart(controller);
    for (const chunk of pending) controller.enqueue(chunk);
    pending = [];
    pendingText = "";
    markerAt = -1;
  };

  /**
   * Try to end the held block as a recovered quiz. Returns false when the held
   * text isn't one, leaving the caller to emit the block unchanged.
   *
   * `endChunk` is the block's `text-end` when the stream produced one; a stream
   * that dies first (abort, or an upstream that closes without it) passes
   * undefined, and the text parts are simply closed by the stream ending.
   */
  const closeBlock = (
    controller: TransformStreamDefaultController<Chunk>,
    endChunk?: Chunk,
  ): boolean => {
    const quiz =
      markerAt === -1 ? null : parseQuizFromText(pendingText.slice(markerAt));
    if (!quiz) return false;
    // Drop the leaked call. Keep any preamble before it as text -- it is a
    // real part of the answer -- and close the block only if text was
    // emitted, so a leak-only block leaves no empty bubble behind.
    const preamble = pendingText.slice(0, markerAt);
    if (startEmitted || preamble.trim().length > 0) {
      emitStart(controller);
      if (preamble.length > 0) {
        controller.enqueue({
          type: "text-delta",
          id: blockId,
          delta: preamble,
        } as Chunk);
      }
      if (endChunk) controller.enqueue(endChunk);
    }
    controller.enqueue({
      type: "tool-input-available",
      toolCallId: nanoid(),
      toolName: "showQuiz",
      input: quiz,
    } as Chunk);
    return true;
  };

  return new TransformStream<Chunk, Chunk>({
    transform(chunk, controller) {
      if (chunk.type === "text-start") {
        // Defensive: a well-formed stream closes a block before opening another.
        if (blockId !== null) flushPending(controller);
        reset();
        blockId = chunk.id;
        startChunk = chunk;
        return;
      }

      const isBlockDelta =
        blockId !== null && chunk.type === "text-delta" && chunk.id === blockId;

      if (isBlockDelta) {
        pending.push(chunk);
        pendingText += deltaOf(chunk);

        if (markerAt === -1) {
          markerAt = findMarker(pendingText);
          if (markerAt === -1) {
            // Release everything except the tail that could still be the start
            // of a marker, so prose streams live.
            while (pending.length > 0) {
              const head = pending[0]!;
              const headLength = deltaOf(head).length;
              if (pendingText.length - headLength < MARKER_LOOKBACK) break;
              emitStart(controller);
              controller.enqueue(head);
              pending.shift();
              pendingText = pendingText.slice(headLength);
            }
            return;
          }
        }

        // Holding: give up as soon as the held text can't be a quiz (or grows
        // past the cap) and go back to watching the rest of the block.
        const held = pendingText.slice(markerAt);
        if (held.length > MAX_HELD_CHARS || !stillPlausible(held)) {
          flushPending(controller);
        }
        return;
      }

      if (
        blockId !== null &&
        chunk.type === "text-end" &&
        chunk.id === blockId
      ) {
        if (!closeBlock(controller, chunk)) {
          flushPending(controller);
          controller.enqueue(chunk);
        }
        reset();
        return;
      }

      // Any other chunk (tool parts, a delta for a different id, etc.). Flush an
      // open block first to preserve ordering.
      if (blockId !== null) {
        flushPending(controller);
        reset();
      }
      controller.enqueue(chunk);
    },
    flush(controller) {
      // A stream that ends without the block's `text-end` -- an abort, or an
      // upstream that just stops -- used to dump the held leak as raw text.
      // Recover it here too, so the student gets the widget rather than the
      // model's own answer key.
      if (blockId !== null && !closeBlock(controller)) flushPending(controller);
      reset();
    },
  });
}
