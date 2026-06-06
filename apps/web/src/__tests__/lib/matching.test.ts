import { describe, it, expect } from "@jest/globals";
import { isMatchingRequest, matchingSchema } from "@/lib/matching";

describe("isMatchingRequest", () => {
  it("matches common matching phrasings", () => {
    const positives = [
      "matching game on spanish vocab",
      "make a matching exercise",
      "create a matching game",
      "match these",
      "matching pairs of countries and capitals",
      "give me a matching quiz",
      "Matching Game",
      "  match these  ",
    ];
    for (const message of positives) {
      expect(isMatchingRequest(message)).toBe(true);
    }
  });

  it("does not match unrelated messages", () => {
    const negatives = [
      "what is matching",
      "I matched the colors",
      "tell me about matching algorithms",
      "",
      "the matching page is broken",
    ];
    for (const message of negatives) {
      expect(isMatchingRequest(message)).toBe(false);
    }
  });
});

describe("matchingSchema", () => {
  const validMatching = {
    matching_title: "Countries and Capitals",
    pairs: [
      { left: "France", right: "Paris" },
      { left: "Japan", right: "Tokyo" },
      { left: "Egypt", right: "Cairo" },
    ],
  };

  it("parses a well-formed matching object", () => {
    const result = matchingSchema.parse(validMatching);
    expect(result).toEqual(validMatching);
  });

  it("rejects fewer than three pairs", () => {
    const result = matchingSchema.safeParse({
      matching_title: "Too few",
      pairs: [
        { left: "France", right: "Paris" },
        { left: "Japan", right: "Tokyo" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than eight pairs", () => {
    const result = matchingSchema.safeParse({
      matching_title: "Too many",
      pairs: Array.from({ length: 9 }, (_, i) => ({
        left: `left-${i}`,
        right: `right-${i}`,
      })),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty left or right string", () => {
    const result = matchingSchema.safeParse({
      matching_title: "Empty entry",
      pairs: [
        { left: "", right: "Paris" },
        { left: "Japan", right: "" },
        { left: "Egypt", right: "Cairo" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing matching_title", () => {
    const result = matchingSchema.safeParse({
      pairs: [
        { left: "France", right: "Paris" },
        { left: "Japan", right: "Tokyo" },
        { left: "Egypt", right: "Cairo" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate left values (board would be unsolvable)", () => {
    const result = matchingSchema.safeParse({
      matching_title: "Capitals",
      pairs: [
        { left: "France", right: "Paris" },
        { left: "France", right: "Tokyo" },
        { left: "Egypt", right: "Cairo" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate right values (board would be unsolvable)", () => {
    const result = matchingSchema.safeParse({
      matching_title: "Capitals",
      pairs: [
        { left: "France", right: "Paris" },
        { left: "Japan", right: "Paris" },
        { left: "Egypt", right: "Cairo" },
      ],
    });
    expect(result.success).toBe(false);
  });
});
