import {
  isFlashcardRequest,
  flashcardsSchema,
  FLASHCARDS_SYSTEM_INSTRUCTION,
  type Flashcards,
} from "@/lib/flashcards";
import type { StructuredMode } from "./types";

export const flashcardsMode: StructuredMode<Flashcards> = {
  id: "flashcards",
  label: "flashcard deck",
  detect: isFlashcardRequest,
  canonicalTrigger: (topic) =>
    topic ? `make me flashcards about ${topic}` : "make me flashcards",
  instruction: FLASHCARDS_SYSTEM_INSTRUCTION,
  schema: flashcardsSchema,
  summarize: (f) => `Flashcards: ${f.deck_title}`,
  fallbackMessage:
    "Sorry, I couldn't put a flashcard deck together just now. Please try asking me for flashcards again.",
};
