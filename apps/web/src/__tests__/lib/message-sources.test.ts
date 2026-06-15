import { describe, it, expect } from "@jest/globals";
import { dedupeSourcesByFileName, describeSource } from "@/lib/message-sources";

describe("dedupeSourcesByFileName", () => {
  it("keeps the highest-similarity chunk per file", () => {
    const result = dedupeSourcesByFileName([
      { fileName: "a.pdf", chunkIndex: 0, similarity: 0.4 },
      { fileName: "a.pdf", chunkIndex: 1, similarity: 0.9 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.similarity).toBe(0.9);
  });

  it("keeps two pages of the same file as separate badges", () => {
    const result = dedupeSourcesByFileName([
      { fileName: "a.pdf", chunkIndex: 0, similarity: 0.8, pageNumber: 3 },
      { fileName: "a.pdf", chunkIndex: 1, similarity: 0.7, pageNumber: 14 },
    ]);
    expect(result).toHaveLength(2);
    expect(
      result.map((s) => s.pageNumber).sort((a, b) => (a ?? 0) - (b ?? 0)),
    ).toEqual([3, 14]);
  });

  it("collapses same file + same page, keeping highest similarity", () => {
    const result = dedupeSourcesByFileName([
      { fileName: "a.pdf", chunkIndex: 0, similarity: 0.5, pageNumber: 3 },
      { fileName: "a.pdf", chunkIndex: 1, similarity: 0.95, pageNumber: 3 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.similarity).toBe(0.95);
  });

  it("treats missing pageNumber as its own key, distinct from a numbered page", () => {
    const result = dedupeSourcesByFileName([
      { fileName: "a.pdf", chunkIndex: 0, similarity: 0.5 },
      { fileName: "a.pdf", chunkIndex: 1, similarity: 0.6, pageNumber: 2 },
    ]);
    expect(result).toHaveLength(2);
  });

  it("returns the input untouched when empty", () => {
    expect(dedupeSourcesByFileName([])).toEqual([]);
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
