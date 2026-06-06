import { quizMode } from "./quiz";
import { flashcardsMode } from "./flashcards";
import { testMode } from "./test-mode";
import { mindmapMode } from "./mindmap";
import { matchingMode } from "./matching";
import type { StructuredMode } from "./types";

/**
 * Ordered registry. Array order defines precedence: the FIRST mode whose `detect`
 * matches wins, preserving the original mutual-exclusivity ladder
 * (quiz -> flashcards -> test -> mindmap -> matching).
 */
export const STRUCTURED_MODES: readonly StructuredMode<unknown>[] = [
  quizMode,
  flashcardsMode,
  testMode,
  mindmapMode,
  matchingMode,
] as StructuredMode<unknown>[];

/** First matching mode for a message, or undefined for a normal chat turn. */
export function detectMode(
  message: string,
): StructuredMode<unknown> | undefined {
  return STRUCTURED_MODES.find((m) => m.detect(message));
}

/** Look up a registered mode by id (used to resolve a confirm card's canonical trigger). */
export function getMode(
  id: string | undefined,
): StructuredMode<unknown> | undefined {
  return STRUCTURED_MODES.find((m) => m.id === id);
}
