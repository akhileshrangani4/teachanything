import { describe, it, expect } from "@jest/globals";
import { detectModeEager } from "@/lib/modes/detection";
import { STRUCTURED_MODES } from "@/lib/modes/registry";

describe("detectModeEager", () => {
  it("catches casual phrasings the strict matcher misses", () => {
    expect(
      detectModeEager("i want u to make me flashcards about ai")?.mode.id,
    ).toBe("flashcards");
    expect(detectModeEager("can we do a quiz on cells")?.mode.id).toBe("quiz");
    expect(
      detectModeEager("lets make a test about photosynthesis")?.mode.id,
    ).toBe("test");
    expect(
      detectModeEager("how about a mind map of the water cycle")?.mode.id,
    ).toBe("mindmap");
    expect(
      detectModeEager("set up a matching game on spanish vocab")?.mode.id,
    ).toBe("matching");
    expect(detectModeEager("i need a quiz on world war 2")?.mode.id).toBe(
      "quiz",
    );
  });

  it("bows out on leading negation (treated as normal chat)", () => {
    expect(detectModeEager("dont make me flashcards")).toBeUndefined();
    expect(
      detectModeEager("do not make flashcards, just explain"),
    ).toBeUndefined();
    expect(detectModeEager("no quiz please")).toBeUndefined();
    expect(detectModeEager("stop the quiz")).toBeUndefined();
    expect(detectModeEager("skip the test for now")).toBeUndefined();
  });

  it("bows out on questions about the tool", () => {
    expect(detectModeEager("what are flashcards")).toBeUndefined();
    expect(detectModeEager("explain quizzes to me")).toBeUndefined();
    expect(detectModeEager("why do we use mind maps")).toBeUndefined();
  });

  it("bows out when there is no request verb", () => {
    // Without a verb we can't be confident it's a request; stay in normal chat.
    expect(detectModeEager("flashcards")).toBeUndefined();
    expect(detectModeEager("the test was hard")).toBeUndefined();
  });

  it("extracts the topic after a connector", () => {
    expect(detectModeEager("make me flashcards about ai")?.topic).toBe("ai");
    expect(detectModeEager("can we do a quiz on cells")?.topic).toBe("cells");
    expect(detectModeEager("i need a quiz on world war 2")?.topic).toBe(
      "world war 2",
    );
    // No connector -> empty topic, still detects the mode.
    expect(detectModeEager("make me flashcards")?.topic).toBe("");
  });

  it("does not fire on 'make flashcards, dont hold back' negation only when leading", () => {
    // Negation guard is anchored to the start, so a non-leading 'dont' still detects.
    expect(
      detectModeEager("make flashcards about cells, dont hold back")?.mode.id,
    ).toBe("flashcards");
  });
});

describe("canonicalTrigger round-trip", () => {
  it("every mode's canonical phrase satisfies its own strict detect", () => {
    for (const mode of STRUCTURED_MODES) {
      for (const topic of ["", "photosynthesis", "world war 2"]) {
        const phrase = mode.canonicalTrigger(topic);
        expect(mode.detect(phrase)).toBe(true);
      }
    }
  });
});
