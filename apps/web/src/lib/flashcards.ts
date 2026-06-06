/**
 * Flashcard Mode: shared types, validation, trigger detection, and the model
 * instruction used to coax a strict-JSON deck out of the LLM.
 *
 * The backend detects a flashcard request, appends FLASHCARDS_SYSTEM_INSTRUCTION
 * to the system prompt, buffers the streamed response, and validates it with
 * `flashcardsSchema` before emitting a structured `flashcards` event to the
 * client.
 */
import { z } from "zod";

const flashcardSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
});

export const flashcardsSchema = z.object({
  deck_title: z.string().min(1),
  // Bounds mirror FLASHCARDS_SYSTEM_INSTRUCTION (5-10 cards). Min 1 stays
  // tolerant of a model that returns slightly fewer rather than failing the deck.
  cards: z.array(flashcardSchema).min(1).max(10),
});

export type Flashcard = z.infer<typeof flashcardSchema>;
export type Flashcards = z.infer<typeof flashcardsSchema>;

/**
 * Phrases that switch the chatbot into Flashcard Mode. Matched against the
 * lowercased, trimmed message. Kept as a readable allowlist rather than one
 * dense regex so it's easy to extend.
 */
const FLASHCARD_TRIGGER_PATTERNS: RegExp[] = [
  // "make flashcards", "make me flashcards", "create flashcards on python", "give me flashcards on X"
  /^(?:can you |could you |please )?(?:make|create|generate|build|give me)\b.*\bflash\s?cards?\b/,
  // "flashcard me", "flash card me"
  /^(?:can you |could you |please )?flash\s?cards?\s+me\b/,
  // "study cards", "give me study cards on X"
  /\bstudy cards?\b/,
];

/**
 * Detect whether the user is asking for flashcards.
 */
export function isFlashcardRequest(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  return FLASHCARD_TRIGGER_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Appended to the system prompt when flashcards are requested. Instructs the
 * model to reply with ONLY minified JSON matching `flashcardsSchema` -- no
 * prose, markdown, or code fences -- so the backend can parse it
 * deterministically.
 */
export const FLASHCARDS_SYSTEM_INSTRUCTION = `

FLASHCARD MODE: The student has asked for flashcards. Generate a study deck based on the course material and context above. Reply with ONLY a single minified JSON object and nothing else -- no prose, no markdown, no code fences, no explanation before or after.

The JSON must match exactly this shape:
{"deck_title":"<short title>","cards":[{"front":"<term or question>","back":"<answer or definition>"}]}

Rules:
- Produce 5 to 10 cards.
- "front" is a concise term/question; "back" is its answer/definition.
- Base cards on the provided course material when available; otherwise use general knowledge of the topic the student asked about.
- Output valid JSON only.`;
