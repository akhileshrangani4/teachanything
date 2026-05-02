import { describe, expect, it } from "@jest/globals";
import {
  getFriendlyError,
  hasActiveCrawl,
  normalizeUrl,
  parsePatternList,
} from "@/components/chatbot/web-sources/utils";

describe("web source UI utilities", () => {
  describe("normalizeUrl", () => {
    it("adds https:// when a protocol is missing", () => {
      expect(normalizeUrl("example.edu/course")).toBe(
        "https://example.edu/course",
      );
    });

    it("keeps existing http and https protocols", () => {
      expect(normalizeUrl("http://example.edu")).toBe("http://example.edu");
      expect(normalizeUrl("https://example.edu")).toBe("https://example.edu");
    });

    it("trims whitespace before normalizing", () => {
      expect(normalizeUrl("  example.edu  ")).toBe("https://example.edu");
    });
  });

  describe("parsePatternList", () => {
    it("splits comma-separated patterns and removes empty entries", () => {
      expect(parsePatternList("/lectures/*, /syllabus, , /readings")).toEqual([
        "/lectures/*",
        "/syllabus",
        "/readings",
      ]);
    });

    it("returns an empty array for blank input", () => {
      expect(parsePatternList("   ")).toEqual([]);
    });
  });

  describe("hasActiveCrawl", () => {
    it("returns true for pending, discovering, or crawling sources", () => {
      expect(
        hasActiveCrawl([{ status: "completed" }, { status: "pending" }]),
      ).toBe(true);
      expect(hasActiveCrawl([{ status: "discovering" }])).toBe(true);
      expect(hasActiveCrawl([{ status: "crawling" }])).toBe(true);
    });

    it("returns false when all sources are inactive", () => {
      expect(
        hasActiveCrawl([{ status: "completed" }, { status: "failed" }]),
      ).toBe(false);
    });
  });

  describe("getFriendlyError", () => {
    it("maps Zod maxPages bounds errors to readable copy", () => {
      const error = {
        message: JSON.stringify([
          {
            code: "too_big",
            path: ["maxPages"],
            maximum: 500,
          },
        ]),
      };
      expect(getFriendlyError(error)).toBe("Max pages cannot exceed 500");
    });

    it("maps URL validation errors to readable copy", () => {
      const error = {
        message: JSON.stringify([
          {
            code: "invalid_format",
            path: ["rootUrl"],
            message: "Invalid URL",
          },
        ]),
      };
      expect(getFriendlyError(error)).toBe("Please enter a valid URL");
    });

    it("returns plain error messages unchanged", () => {
      expect(
        getFriendlyError({ message: "A crawl is already in progress" }),
      ).toBe("A crawl is already in progress");
    });
  });
});
