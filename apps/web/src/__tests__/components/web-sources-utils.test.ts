import { describe, expect, it } from "@jest/globals";
import {
  getFriendlyError,
  hasActiveCrawl,
  isActiveSource,
  normalizeUrl,
  parsePatternList,
} from "@/components/chatbot/web-sources/utils";
import en from "../../../messages/en.json";
import { crawlSourceInput } from "@/server/routers/crawler/validation";
import { createI18n } from "@/i18n/create-i18n";

const { t } = createI18n("en", en);

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

  describe("isActiveSource", () => {
    it("returns true for pending, discovering, or crawling sources", () => {
      expect(isActiveSource({ status: "pending" })).toBe(true);
      expect(isActiveSource({ status: "discovering" })).toBe(true);
      expect(isActiveSource({ status: "crawling" })).toBe(true);
    });

    it("returns false for terminal or disabled statuses", () => {
      expect(isActiveSource({ status: "completed" })).toBe(false);
      expect(isActiveSource({ status: "failed" })).toBe(false);
      expect(isActiveSource({ status: "cancelled" })).toBe(false);
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
    const patternError = (patterns: string[]) => {
      const result = crawlSourceInput.safeParse({
        rootUrl: "https://example.com",
        includePatterns: patterns,
      });
      return getFriendlyError({ message: result.error!.message }, t);
    };

    it("explains an invalid pattern, once however many fail", () => {
      expect(patternError(["/actualités/*", "/blog?page=*"])).toBe(
        en.webSources.validation.patternInvalidCharacters,
      );
    });

    it("gives the limit for a long pattern", () => {
      expect(patternError(["a".repeat(201)])).toBe(
        "Each URL pattern can have at most 200 characters",
      );
    });

    it("gives the limit for too many patterns", () => {
      expect(patternError(Array(11).fill("/a"))).toBe(
        "Use at most 10 URL patterns per list",
      );
    });

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
      expect(getFriendlyError(error, t)).toBe("Max pages cannot exceed 500");
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
      expect(getFriendlyError(error, t)).toBe("Please enter a valid URL");
    });

    it("returns plain error messages unchanged", () => {
      expect(
        getFriendlyError({ message: "A crawl is already in progress" }, t),
      ).toBe("A crawl is already in progress");
    });
  });
});
