import { describe, expect, it } from "@jest/globals";
import {
  getPageDisplayTitle,
  getSourceDisplayName,
  getSourceErrorCount,
  getSourcePageCount,
  resolveSourceDisplayName,
} from "@/lib/crawler-metadata";

describe("crawler metadata helpers", () => {
  describe("resolveSourceDisplayName", () => {
    it("uses the trimmed display name when present", () => {
      expect(
        resolveSourceDisplayName("  Course Site  ", "https://example.edu"),
      ).toBe("Course Site");
    });

    it("falls back to the root URL when display name is null", () => {
      expect(resolveSourceDisplayName(null, "https://example.edu")).toBe(
        "https://example.edu",
      );
    });

    it("falls back to the root URL when display name is undefined", () => {
      expect(resolveSourceDisplayName(undefined, "https://example.edu")).toBe(
        "https://example.edu",
      );
    });

    it("falls back to the root URL when display name is whitespace only", () => {
      expect(resolveSourceDisplayName("   ", "https://example.edu")).toBe(
        "https://example.edu",
      );
    });
  });

  describe("getSourceDisplayName", () => {
    it("uses the trimmed custom source display name", () => {
      expect(
        getSourceDisplayName({
          rootUrl: "https://example.edu",
          metadata: { displayName: "  Course Site  " },
        }),
      ).toBe("Course Site");
    });

    it("falls back to the root URL when no display name exists", () => {
      expect(
        getSourceDisplayName({
          rootUrl: "https://example.edu",
          metadata: {},
        }),
      ).toBe("https://example.edu");
    });
  });

  describe("getSourcePageCount", () => {
    it("returns the stored page count", () => {
      expect(getSourcePageCount({ metadata: { pageCount: 12 } })).toBe(12);
    });

    it("falls back to zero when page count is missing", () => {
      expect(getSourcePageCount({ metadata: {} })).toBe(0);
    });
  });

  describe("getSourceErrorCount", () => {
    it("returns the stored error count", () => {
      expect(getSourceErrorCount({ metadata: { errorCount: 3 } })).toBe(3);
    });

    it("falls back to zero when error count is missing", () => {
      expect(getSourceErrorCount({ metadata: null })).toBe(0);
    });
  });

  describe("getPageDisplayTitle", () => {
    it("prefers the trimmed custom title over the crawled title", () => {
      expect(
        getPageDisplayTitle({
          title: "Original HTML Title",
          url: "https://example.edu/plays/winters-tale",
          metadata: { customTitle: "  Winter's Tale Folger full text  " },
        }),
      ).toBe("Winter's Tale Folger full text");
    });

    it("falls back to the crawled title when no custom title exists", () => {
      expect(
        getPageDisplayTitle({
          title: "Original HTML Title",
          url: "https://example.edu/plays/winters-tale",
          metadata: {},
        }),
      ).toBe("Original HTML Title");
    });

    it("falls back to the URL when no title exists", () => {
      expect(
        getPageDisplayTitle({
          title: null,
          url: "https://example.edu/plays/winters-tale",
          metadata: {},
        }),
      ).toBe("https://example.edu/plays/winters-tale");
    });
  });
});
