import { describe, it, expect } from "@jest/globals";
import { detectMode, STRUCTURED_MODES } from "@/lib/modes/registry";

describe("detectMode routing", () => {
  it("routes quiz requests to the quiz mode", () => {
    expect(detectMode("quiz me")?.id).toBe("quiz");
  });

  it("routes flashcard requests to the flashcards mode", () => {
    expect(detectMode("flashcard me")?.id).toBe("flashcards");
    expect(detectMode("make flashcards")?.id).toBe("flashcards");
  });

  it("routes test requests to the test mode", () => {
    expect(detectMode("test me")?.id).toBe("test");
    expect(detectMode("give me a test")?.id).toBe("test");
  });

  it("routes mind map requests to the mindmap mode", () => {
    expect(detectMode("make a mind map")?.id).toBe("mindmap");
    expect(detectMode("concept map")?.id).toBe("mindmap");
  });

  it("returns undefined for normal chat turns", () => {
    expect(detectMode("hello there")).toBeUndefined();
    expect(detectMode("explain recursion")).toBeUndefined();
  });
});

describe("STRUCTURED_MODES registry", () => {
  it("locks the precedence ordering", () => {
    expect(STRUCTURED_MODES.map((m) => m.id)).toEqual([
      "quiz",
      "flashcards",
      "test",
      "mindmap",
      "matching",
    ]);
  });

  it("exposes the full descriptor for every mode", () => {
    for (const m of STRUCTURED_MODES) {
      expect(typeof m.detect).toBe("function");
      expect(typeof m.summarize).toBe("function");
      expect(typeof m.instruction).toBe("string");
      expect(typeof m.fallbackMessage).toBe("string");
      expect(m.schema).toBeDefined();
    }
  });
});
