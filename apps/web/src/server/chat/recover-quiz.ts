import { nanoid } from "nanoid";
import { parseQuizFromText } from "@/lib/quiz";
import type { Chunk } from "./ui-chunks";

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

/**
 * How much held text has to accumulate before the "Building your quiz..."
 * placeholder is shown.
 *
 * The point of the threshold is to separate a real leak from a short non-quiz
 * JSON blob. A five-question quiz with explanations serializes to 2KB or more,
 * while the quiz-shaped false positives in `leak-false-positives.test.ts` are
 * all under 200 characters, so nothing in that corpus can reach this.
 */
const QUIZ_PLACEHOLDER_MIN_CHARS = 600;

/**
 * Whether held text is a quiz being written, confidently enough to show the
 * placeholder for it.
 *
 * Stricter than `stillPlausible`, which only asks "could this still be a quiz".
 * Both keys are required: a blob carrying just one of them (a `questions` array
 * with no title, a title with no questions) is a shape the parser rejects
 * anyway.
 */
function isQuizInProgress(held: string): boolean {
  return (
    held.length >= QUIZ_PLACEHOLDER_MIN_CHARS &&
    /quiz_title/.test(held) &&
    /"question"\s*:/.test(held)
  );
}

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
 * Note the placeholder behaviour, which is what the reporting professor actually
 * experienced: buffering the leak means nothing reaches the screen between the
 * model's preamble ("Here are 5 multiple-choice questions:") and the finished
 * widget. On Llama 4 Maverick that gap averaged 59s and peaked at 172s, so the
 * quiz read as a dead stream and users gave up before it arrived. Once the held
 * text is unmistakably a quiz being written, a `tool-input-start` is emitted so
 * the existing `QuizSkeleton` ("Building your quiz...") fills the gap, exactly as
 * it already does for a native streamed tool call.
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
  /**
   * Set once the placeholder has been emitted, which is also the point of no
   * return: the held text has been declared a quiz, so it is never released as
   * prose afterwards. That is deliberate. The alternative is printing the
   * model's own answer key to the student, which is the failure this whole
   * transform exists to prevent.
   */
  let placeholderCallId: string | null = null;

  const reset = () => {
    blockId = null;
    startChunk = null;
    startEmitted = false;
    pending = [];
    pendingText = "";
    markerAt = -1;
    placeholderCallId = null;
  };

  const deltaOf = (chunk: Chunk): string =>
    (chunk as { delta?: string }).delta ?? "";

  const emitStart = (controller: TransformStreamDefaultController<Chunk>) => {
    if (startEmitted || !startChunk) return;
    controller.enqueue(startChunk);
    startEmitted = true;
  };

  /**
   * Emit every unemitted chunk of the block exactly as it arrived.
   *
   * Once the placeholder is up the held text is NOT released: it was already
   * declared a quiz, and the raw form is the model's answer key. The placeholder
   * is turned into an error notice instead, so the student sees that the quiz
   * failed rather than the answers to it.
   */
  const flushPending = (
    controller: TransformStreamDefaultController<Chunk>,
  ) => {
    if (placeholderCallId) {
      controller.enqueue({
        type: "tool-output-error",
        toolCallId: placeholderCallId,
        errorText: "The quiz could not be built. Please ask again.",
      });
      placeholderCallId = null;
      pending = [];
      pendingText = "";
      markerAt = -1;
      return;
    }
    if (pending.length > 0 || !startEmitted) emitStart(controller);
    for (const chunk of pending) controller.enqueue(chunk);
    pending = [];
    pendingText = "";
    markerAt = -1;
  };

  /**
   * Show "Building your quiz..." once the held text is unmistakably a quiz.
   *
   * The preamble is released first so the widget lands BELOW the model's
   * sentence rather than above it, and it is dropped from the buffer at the same
   * time so `closeBlock` cannot emit it twice.
   */
  const startPlaceholder = (
    controller: TransformStreamDefaultController<Chunk>,
    held: string,
  ) => {
    if (placeholderCallId || markerAt === -1 || !isQuizInProgress(held)) return;

    // markerAt is only ever set while an open text block is being buffered,
    // so blockId is provably non-null here; the check keeps TS honest.
    const id = blockId;
    if (id === null) return;

    const preamble = pendingText.slice(0, markerAt);
    if (preamble.trim().length > 0) {
      emitStart(controller);
      controller.enqueue({
        type: "text-delta",
        id,
        delta: preamble,
      });
      controller.enqueue({ type: "text-end", id });
    }
    // The preamble is out, and the rest is the leak. `pending` holds the raw
    // chunks that would have been replayed as prose; they are no longer needed.
    pendingText = pendingText.slice(markerAt);
    markerAt = 0;
    pending = [];

    placeholderCallId = nanoid();
    controller.enqueue({
      type: "tool-input-start",
      toolCallId: placeholderCallId,
      toolName: "showQuiz",
    });
  };

  /**
   * Try to end the held block as a recovered quiz. Returns false when the held
   * text isn't one, leaving the caller to emit the block unchanged.
   *
   * `endChunk` is the block's `text-end` when the stream produced one; a stream
   * that dies first (abort, or an upstream that closes without it) passes
   * undefined, in which case a `text-end` is synthesized. Every `text-start`
   * this transform emits gets a matching `text-end`: an unterminated text part
   * stays in `streaming` state on the client and in the persisted parts, which
   * renders the preamble as a message that never finished arriving.
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
    // Already released when the placeholder went up, in which case markerAt was
    // reset to 0 and this is empty.
    const preamble = pendingText.slice(0, markerAt);
    if (!placeholderCallId && (startEmitted || preamble.trim().length > 0)) {
      const id = blockId;
      emitStart(controller);
      if (id !== null && preamble.length > 0) {
        controller.enqueue({
          type: "text-delta",
          id,
          delta: preamble,
        });
      }
      if (endChunk) {
        controller.enqueue(endChunk);
      } else if (id !== null) {
        controller.enqueue({ type: "text-end", id });
      }
    }
    // Reuse the placeholder's id so the skeleton becomes the finished quiz
    // instead of a second widget appearing beneath it.
    controller.enqueue({
      type: "tool-input-available",
      toolCallId: placeholderCallId ?? nanoid(),
      toolName: "showQuiz",
      input: quiz,
    });
    placeholderCallId = null;
    return true;
  };

  /**
   * Flush a block that will never receive its own `text-end` -- the stream
   * ended, or a non-text chunk arrived while the block was still open -- and
   * close it. `flushPending` always emits the `text-start`, so there is always a
   * part to close.
   */
  const endBlock = (controller: TransformStreamDefaultController<Chunk>) => {
    const id = blockId;
    // Read before flushing: a committed placeholder means the text part was
    // already closed when the preamble was released, so closing it again would
    // emit a stray `text-end`.
    const textPartOpen = placeholderCallId === null;
    flushPending(controller);
    if (id !== null && textPartOpen) {
      controller.enqueue({ type: "text-end", id });
    }
  };

  return new TransformStream<Chunk, Chunk>({
    transform(chunk, controller) {
      if (chunk.type === "text-start") {
        // Defensive: a well-formed stream closes a block before opening another.
        if (blockId !== null) endBlock(controller);
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
          return;
        }
        startPlaceholder(controller, held);
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
        endBlock(controller);
        reset();
      }
      controller.enqueue(chunk);
    },
    flush(controller) {
      // A stream that ends without the block's `text-end` -- an abort, or an
      // upstream that just stops -- used to dump the held leak as raw text.
      // Recover it here too, so the student gets the widget rather than the
      // model's own answer key.
      if (blockId !== null && !closeBlock(controller)) endBlock(controller);
      reset();
    },
  });
}
