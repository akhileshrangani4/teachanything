/**
 * Pure heuristics shared by the leaked-quiz recovery transform. These inspect
 * buffered text only -- no stream state -- so they sit apart from the
 * `TransformStream` factory in recover-quiz.ts.
 */

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
export const MARKER_LOOKBACK = "[showQuiz(".length - 1;

/**
 * Hard cap on held text. A 5-question quiz serializes to ~2KB, so anything past
 * this is not the leak we're looking for; bail out rather than withhold an
 * unbounded stretch of a real answer.
 */
export const MAX_HELD_CHARS = 8_000;

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
export function isQuizInProgress(held: string): boolean {
  return (
    held.length >= QUIZ_PLACEHOLDER_MIN_CHARS &&
    /quiz_title/.test(held) &&
    /"question"\s*:/.test(held)
  );
}

/** Index where the earliest leak marker starts in `text`, or -1. */
export function findMarker(text: string): number {
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
export function stillPlausible(held: string): boolean {
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
