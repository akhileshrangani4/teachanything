import { describe, it, expect } from "@jest/globals";
import { shuffleRight, computeAccuracy } from "@/lib/matching-game";

const PAIRS = [
  { left: "France", right: "Paris" },
  { left: "Japan", right: "Tokyo" },
  { left: "Egypt", right: "Cairo" },
  { left: "Peru", right: "Lima" },
];

describe("shuffleRight", () => {
  it("returns one entry per pair, each tagged with its original pairIndex", () => {
    const result = shuffleRight(PAIRS);
    expect(result).toHaveLength(PAIRS.length);
    // Every entry's text must still correspond to its pairIndex's right value,
    // so a match check (right.pairIndex === leftIndex) stays correct after shuffle.
    for (const entry of result) {
      expect(entry.text).toBe(PAIRS[entry.pairIndex]!.right);
    }
  });

  it("preserves the full set of pairIndexes exactly once (no drop/dup)", () => {
    const indexes = shuffleRight(PAIRS)
      .map((e) => e.pairIndex)
      .sort((a, b) => a - b);
    expect(indexes).toEqual([0, 1, 2, 3]);
  });

  it("handles a single-pair input without error", () => {
    const result = shuffleRight([{ left: "a", right: "b" }]);
    expect(result).toEqual([{ text: "b", pairIndex: 0 }]);
  });

  it("produces every position for an index over many runs (unbiased enough)", () => {
    // A correct Fisher-Yates puts element 0 into each of the N positions with
    // roughly equal probability. Assert it lands in every slot at least once
    // across many runs -- catches an off-by-one (j in [0,i) bias) that would
    // pin element 0 to a subset of positions.
    const seenPositionsForPair0 = new Set<number>();
    for (let run = 0; run < 500; run++) {
      const result = shuffleRight(PAIRS);
      seenPositionsForPair0.add(result.findIndex((e) => e.pairIndex === 0));
    }
    expect(seenPositionsForPair0).toEqual(new Set([0, 1, 2, 3]));
  });
});

describe("computeAccuracy", () => {
  it("is 100% for a perfect run (one attempt per pair)", () => {
    expect(computeAccuracy(4, 4)).toBe(100);
  });

  it("drops below 100% when there are wrong attempts", () => {
    expect(computeAccuracy(4, 8)).toBe(50);
    expect(computeAccuracy(4, 5)).toBe(80);
  });

  it("rounds to the nearest whole percent", () => {
    // 4 / 6 = 66.66% -> 67
    expect(computeAccuracy(4, 6)).toBe(67);
  });

  it("guards the zero-attempt case to 100", () => {
    expect(computeAccuracy(4, 0)).toBe(100);
    expect(computeAccuracy(0, 0)).toBe(100);
  });
});
