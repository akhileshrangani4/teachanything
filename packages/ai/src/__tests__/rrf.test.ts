import { describe, it, expect } from "@jest/globals";
import { reciprocalRankFusion } from "../rrf";

describe("reciprocalRankFusion", () => {
  it("rewards items ranked highly across multiple lists", () => {
    const fused = reciprocalRankFusion(
      [
        { items: ["A", "C", "B"], weight: 1 }, // ranks: A=1,C=2,B=3
        { items: ["B", "D", "E", "F", "A"], weight: 1 }, // ranks: B=1..A=5
      ],
      { k: 60 },
    );
    // B (1 + 3) beats A (1 + 5)
    expect(fused[0]).toBe("B");
    expect(fused).toContain("A");
  });

  it("keeps items present in only one list", () => {
    const fused = reciprocalRankFusion(
      [
        { items: ["A"], weight: 1 },
        { items: ["B"], weight: 1 },
      ],
      { k: 60 },
    );
    expect(new Set(fused)).toEqual(new Set(["A", "B"]));
  });

  it("applies per-list weight (quoted-phrase boost)", () => {
    const fused = reciprocalRankFusion(
      [
        { items: ["A", "B"], weight: 1 },
        { items: ["B", "A"], weight: 3 },
      ],
      { k: 60 },
    );
    expect(fused[0]).toBe("B");
  });
});
