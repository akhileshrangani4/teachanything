import { describe, it, expect } from "@jest/globals";
import { reciprocalRankFusion } from "@teachanything/ai/rrf";

// Regression for issue #271: a close-reading detail question must surface the
// exact-answer chunk even when dense vector search under-ranks it (semantic
// dilution), because lexical (FTS + trigram) signals rank it highly. The setup
// chunk (N-1) should also be retrieved for adjacent context.
describe("close-reading adjacency retrieval (fusion level)", () => {
  it("surfaces the exact-answer chunk even when vector under-ranks it", () => {
    const vector = ["chunkN-1", "chunkX", "chunkY", "chunkN"]; // answer (N) ranked 4th
    const fts = ["chunkN", "chunkN-1"]; // exact term -> N ranked 1st
    const trgm = ["chunkN"]; // exact substring -> N ranked 1st

    const fused = reciprocalRankFusion(
      [
        { items: vector, weight: 1 },
        { items: fts, weight: 2 }, // quoted-phrase boost
        { items: trgm, weight: 1 },
      ],
      { k: 60 },
    );

    expect(fused[0]).toBe("chunkN");
    // The setup chunk is retrieved alongside the answer for adjacent context.
    expect(fused.slice(0, 3)).toContain("chunkN-1");
  });
});
