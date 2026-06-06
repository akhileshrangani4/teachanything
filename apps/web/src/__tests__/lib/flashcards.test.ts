import { describe, it, expect } from "@jest/globals";
import { isFlashcardRequest, flashcardsSchema } from "@/lib/flashcards";

describe("isFlashcardRequest", () => {
  it("matches common flashcard phrasings", () => {
    const positives = [
      "make flashcards",
      "Make flashcards",
      "  MAKE FLASHCARDS  ",
      "flashcard me",
      "flash card me",
      "study cards",
      "give me flashcards on python",
      "make me flashcards on the cell cycle",
      "create flashcards on photosynthesis",
      "can you make flashcards",
    ];
    for (const message of positives) {
      expect(isFlashcardRequest(message)).toBe(true);
    }
  });

  it("does not match unrelated messages", () => {
    const negatives = [
      "what is a flashcard",
      "I made flashcards yesterday",
      "tell me about the syllabus",
      "explain recursion",
      "",
      "thanks!",
    ];
    for (const message of negatives) {
      expect(isFlashcardRequest(message)).toBe(false);
    }
  });
});

describe("flashcardsSchema", () => {
  const validDeck = {
    deck_title: "Python Basics Deck",
    cards: [
      {
        front: "What keyword defines a function?",
        back: "The 'def' keyword defines functions in Python.",
      },
      {
        front: "What does print() do?",
        back: "It writes output to standard output.",
      },
    ],
  };

  it("parses a well-formed deck", () => {
    const result = flashcardsSchema.safeParse(validDeck);
    expect(result.success).toBe(true);
  });

  it("rejects a deck with no cards", () => {
    const result = flashcardsSchema.safeParse({
      deck_title: "Empty",
      cards: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a deck with more than ten cards", () => {
    const result = flashcardsSchema.safeParse({
      deck_title: "Too many cards",
      cards: Array.from({ length: 11 }, (_, i) => ({
        front: `front ${i}`,
        back: `back ${i}`,
      })),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a card missing its front", () => {
    const result = flashcardsSchema.safeParse({
      deck_title: "Missing front",
      cards: [{ front: "", back: "an answer" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a card missing its back", () => {
    const result = flashcardsSchema.safeParse({
      deck_title: "Missing back",
      cards: [{ front: "a question", back: "" }],
    });
    expect(result.success).toBe(false);
  });
});
