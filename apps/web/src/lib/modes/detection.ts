/**
 * Two-phase mode detection.
 *
 * STRICT detection (each mode's `detect`, in registry.ts) is what actually
 * triggers JSON generation -- it is intentionally narrow to avoid false
 * positives. EAGER detection (here) is looser: it catches casual phrasings the
 * strict matcher misses ("i want u to make flashcards", "flashcards pls") so we
 * can show a Yes/No confirmation card. Because the confirmation is the real
 * safety net, eager detection can be generous; a leading-negation guard handles
 * the obvious "don't make me flashcards" case cheaply.
 *
 * Flow: eager match -> confirm card -> on Yes, send `mode.canonicalTrigger(topic)`
 * which is guaranteed to pass the STRICT `detect`, running the normal pipeline.
 */
import { STRUCTURED_MODES } from "./registry";
import type { StructuredMode, StructuredModeId } from "./types";

/**
 * Loose noun patterns per mode, matched anywhere in the lowercased message. The
 * study verb is checked separately so order/phrasing is flexible.
 */
const EAGER_NOUN_PATTERNS: Record<StructuredModeId, RegExp> = {
  flashcards: /\bflash\s?cards?\b|\bstudy cards?\b/,
  quiz: /\bquiz(?:zes)?\b/,
  test: /\b(?:test|exam)\b/,
  mindmap: /\b(?:mind|concept)\s?maps?\b/,
  matching:
    /\bmatching (?:game|exercise|pairs)\b|\bmatch (?:these|the following)\b/,
};

/** A request verb somewhere in the message (make/create/give me/do/want/...). */
const REQUEST_VERB =
  /\b(?:make|create|generate|build|give|do|want|need|can|could|let'?s|how about|set up|put together|whip up)\b/;

/**
 * Leading negation: if the message opens by rejecting the action ("don't make
 * flashcards", "no quiz", "stop the test"), eager detection bows out and the
 * turn is treated as normal chat. Anchored near the start so "make flashcards,
 * don't hold back" is unaffected.
 */
const LEADING_NEGATION =
  /^(?:no\b|nope\b|don'?t\b|do not\b|stop\b|never\b|without\b|skip\b|not\b|rather not\b|no need\b)/;

/** Words that signal a QUESTION about the tool rather than a request for one. */
const QUESTION_PREFIX =
  /^(?:what|what'?s|whats|why|when|who|which|explain|define|tell me about|how do|how does|how to)\b/;

export interface EagerMatch {
  mode: StructuredMode<unknown>;
  /** Best-effort topic extracted from the message; "" if none found. */
  topic: string;
}

/**
 * Extract the topic after a connector ("about/on/for/of") or fall back to "".
 * Strips the noun phrase and common request boilerplate so the topic reads
 * naturally in the confirm prompt and the canonical trigger.
 */
function extractTopic(normalized: string): string {
  const connector = normalized.match(
    /\b(?:about|on|for|of|regarding|covering)\s+(.+)$/,
  );
  if (!connector?.[1]) return "";
  return connector[1]
    .replace(/[?!.]+$/, "")
    .replace(/\b(?:please|pls|thanks|thank you|asap)\b/g, "")
    .trim();
}

/**
 * Eager, confirmation-gated detection. Returns the first mode (registry order)
 * whose noun appears alongside a request verb, unless the message is a leading
 * negation or a question about the tool. Undefined means "treat as normal chat".
 */
export function detectModeEager(message: string): EagerMatch | undefined {
  const normalized = message.toLowerCase().trim();
  if (!normalized) return undefined;
  if (LEADING_NEGATION.test(normalized)) return undefined;
  if (QUESTION_PREFIX.test(normalized)) return undefined;
  if (!REQUEST_VERB.test(normalized)) return undefined;

  for (const mode of STRUCTURED_MODES) {
    const noun = EAGER_NOUN_PATTERNS[mode.id];
    if (noun.test(normalized)) {
      return { mode, topic: extractTopic(normalized) };
    }
  }
  return undefined;
}
