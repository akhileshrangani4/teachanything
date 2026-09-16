import { describe, it, expect } from "@jest/globals";
import {
  describeSource,
  groupSourcesByFile,
  sourceDisplayName,
} from "@/lib/message-sources";

describe("sourceDisplayName", () => {
  it("collapses crawler URLs to Web: <hostname>", () => {
    expect(
      sourceDisplayName("Course Syllabus", "https://example.edu/syllabus"),
    ).toBe("Web: example.edu");
    expect(sourceDisplayName("Page", "http://sub.example.com/a/b?q=1")).toBe(
      "Web: sub.example.com",
    );
  });

  it("keeps the file name for storage-path uploads", () => {
    expect(sourceDisplayName("syllabus.pdf", "uploads/user/syllabus.pdf")).toBe(
      "syllabus.pdf",
    );
  });

  it("keeps the file name when storagePath is missing", () => {
    expect(sourceDisplayName("syllabus.pdf", null)).toBe("syllabus.pdf");
    expect(sourceDisplayName("syllabus.pdf", undefined)).toBe("syllabus.pdf");
  });

  it("falls back to the raw name on a malformed URL", () => {
    expect(sourceDisplayName("page.html", "http://")).toBe("page.html");
  });

  it("labels an empty file name as Unknown", () => {
    expect(sourceDisplayName("", "uploads/x")).toBe("Unknown");
  });
});

describe("describeSource", () => {
  it("strips the Web: prefix and flags web sources", () => {
    expect(describeSource({ fileName: "Web: example.edu" })).toEqual({
      isWeb: true,
      label: "example.edu",
    });
  });

  it("returns file sources as-is", () => {
    expect(describeSource({ fileName: "syllabus.pdf" })).toEqual({
      isWeb: false,
      label: "syllabus.pdf",
    });
  });
});

/**
 * #397: the "Sources:" footer rendered one uncapped badge per citation, so a
 * reply drawing on several pages of a PDF produced a source block taller than
 * the answer it belonged to. Grouping per file is half the fix; the cap in
 * `SourceList` is the other half.
 */
describe("groupSourcesByFile", () => {
  it("collapses every page of one file into a single entry", () => {
    const result = groupSourcesByFile([
      { fileName: "report.pdf", chunkIndex: 0, similarity: 0.6, pageNumber: 3 },
      { fileName: "report.pdf", chunkIndex: 1, similarity: 0.9, pageNumber: 1 },
      { fileName: "report.pdf", chunkIndex: 2, similarity: 0.5, pageNumber: 7 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.fileName).toBe("report.pdf");
    // Ascending, so the badge tooltip reads in document order rather than
    // retrieval order.
    expect(result[0]?.pageNumbers).toEqual([1, 3, 7]);
  });

  it("carries the best similarity and its chunk", () => {
    const result = groupSourcesByFile([
      { fileName: "a.pdf", chunkIndex: 4, similarity: 0.42, pageNumber: 2 },
      { fileName: "a.pdf", chunkIndex: 9, similarity: 0.91, pageNumber: 5 },
    ]);

    expect(result[0]?.similarity).toBe(0.91);
    expect(result[0]?.chunkIndex).toBe(9);
  });

  it("orders files by their best match, so a cap keeps what mattered", () => {
    const result = groupSourcesByFile([
      { fileName: "weak.pdf", chunkIndex: 0, similarity: 0.2, pageNumber: 1 },
      {
        fileName: "strong.pdf",
        chunkIndex: 0,
        similarity: 0.95,
        pageNumber: 1,
      },
      {
        fileName: "middling.pdf",
        chunkIndex: 0,
        similarity: 0.6,
        pageNumber: 1,
      },
    ]);

    expect(result.map((s) => s.fileName)).toEqual([
      "strong.pdf",
      "middling.pdf",
      "weak.pdf",
    ]);
  });

  it("keeps separate files separate", () => {
    const result = groupSourcesByFile([
      { fileName: "a.pdf", chunkIndex: 0, similarity: 0.8, pageNumber: 1 },
      { fileName: "b.pdf", chunkIndex: 0, similarity: 0.7, pageNumber: 1 },
    ]);

    expect(result).toHaveLength(2);
  });

  it("gives a web source no pages", () => {
    // Crawled pages collapse to `Web: <hostname>` upstream and carry no page
    // number, so the badge must not claim one.
    const result = groupSourcesByFile([
      { fileName: "Web: example.edu", chunkIndex: 0, similarity: 0.8 },
      { fileName: "Web: example.edu", chunkIndex: 1, similarity: 0.6 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.pageNumbers).toEqual([]);
  });

  it("does not repeat a page cited by two chunks", () => {
    const result = groupSourcesByFile([
      { fileName: "a.pdf", chunkIndex: 0, similarity: 0.8, pageNumber: 4 },
      { fileName: "a.pdf", chunkIndex: 1, similarity: 0.7, pageNumber: 4 },
    ]);

    expect(result[0]?.pageNumbers).toEqual([4]);
  });

  it("handles a file cited both with and without a page", () => {
    const result = groupSourcesByFile([
      { fileName: "a.pdf", chunkIndex: 0, similarity: 0.8 },
      { fileName: "a.pdf", chunkIndex: 1, similarity: 0.7, pageNumber: 2 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.pageNumbers).toEqual([2]);
  });

  it("returns nothing for no sources", () => {
    expect(groupSourcesByFile([])).toEqual([]);
  });
});
