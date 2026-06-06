/**
 * Matching Mode: a two-column matching game. The model returns a title plus an
 * array of left/right pairs; the client renders it as an interactive matching
 * exercise. Shares the structured-mode pipeline (detect -> strict-JSON
 * instruction -> buffer -> validate -> structured event) with Quiz, Flashcard,
 * Test, and Mind Map mode.
 */
import { z } from "zod";

export const matchingPairSchema = z.object({
  left: z.string().min(1),
  right: z.string().min(1),
});

export const matchingSchema = z
  .object({
    matching_title: z.string().min(1),
    pairs: z.array(matchingPairSchema).min(3).max(8),
  })
  // The game is only solvable if every term and every match is distinct: a
  // duplicate left or right would make two cells indistinguishable. The model
  // is instructed to avoid duplicates, but enforce it so a slip falls back to a
  // friendly message rather than rendering a broken, unwinnable board.
  .superRefine((m, ctx) => {
    const lefts = m.pairs.map((p) => p.left);
    const rights = m.pairs.map((p) => p.right);
    if (new Set(lefts).size !== lefts.length) {
      ctx.addIssue({
        code: "custom",
        message: "pairs must not contain duplicate left values",
        path: ["pairs"],
      });
    }
    if (new Set(rights).size !== rights.length) {
      ctx.addIssue({
        code: "custom",
        message: "pairs must not contain duplicate right values",
        path: ["pairs"],
      });
    }
  });

export type MatchingPair = z.infer<typeof matchingPairSchema>;
export type Matching = z.infer<typeof matchingSchema>;

/**
 * Phrases that switch the chatbot into Matching Mode. Matched against the
 * lowercased, trimmed message. Anchored to the start of the message to avoid
 * mid-sentence false positives ("what is matching", "I matched the colors").
 */
const MATCHING_TRIGGER_PATTERNS: RegExp[] = [
  // verb-led: "make a matching game", "create a matching exercise", "give me a matching quiz", "match these"
  /^(?:can you |could you |please )?(?:make|create|build|generate|give me|start|show) (?:me )?(?:a |an |the )?match(?:ing)?(?: pairs| game| exercise| quiz)?\b/,
  // "matching game on X", "matching pairs of X", "match these" -- matching/match followed by a topic
  /^match(?:ing)?(?: pairs| game| exercise)?\b/,
];

/**
 * Detect whether the user is asking for a matching game.
 */
export function isMatchingRequest(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  return MATCHING_TRIGGER_PATTERNS.some((p) => p.test(normalized));
}

/**
 * Appended to the system prompt when a matching game is requested. Instructs the
 * model to reply with ONLY minified JSON matching `matchingSchema` -- no prose,
 * markdown, or code fences -- so the backend can parse it deterministically.
 */
export const MATCHING_SYSTEM_INSTRUCTION = `

MATCHING MODE: The student has asked for a matching game. Generate a two-column matching exercise based on the course material and context above. Reply with ONLY a single minified JSON object and nothing else -- no prose, no markdown, no code fences, no explanation before or after.

The JSON must match exactly this shape:
{"matching_title":"<short title>","pairs":[{"left":"<term>","right":"<match>"}]}

Rules:
- Produce 4 to 8 pairs.
- The left column is one set (e.g. Spanish vocabulary words); the right column holds the corresponding matches (e.g. their English meanings).
- Keep each entry short -- a word or short phrase, not a full sentence.
- Every left maps to exactly one right; no duplicate lefts and no duplicate rights.
- Base the pairs on the provided course material when available; otherwise use general knowledge of the topic.
- Output valid JSON only.`;
