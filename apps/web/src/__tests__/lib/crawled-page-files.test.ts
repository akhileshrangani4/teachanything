import { describe, it, expect } from "@jest/globals";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  excludeCrawledPages,
  isCrawledPagePath,
} from "@/server/crawled-page-files";

/**
 * `userFiles` mixes uploads and crawled pages, and `storagePath` is the only
 * thing telling them apart. Both forms of the check are pinned here because
 * they guard different layers -- the SQL one keeps crawled pages out of the
 * Files tab and out of `sweepStaleFiles`, the predicate one keeps the guarantee
 * if a future caller hands a row straight to `isStaleFile`.
 */
describe("isCrawledPagePath", () => {
  it("recognizes a crawled page by its URL storagePath", () => {
    expect(isCrawledPagePath("https://example.edu/syllabus")).toBe(true);
    expect(isCrawledPagePath("http://example.edu/syllabus")).toBe(true);
  });

  it("treats an uploaded object key as an upload", () => {
    expect(isCrawledPagePath("abc123/9f1c-4e2b.pdf")).toBe(false);
    // Uploaded paths are `{userId}/{fileId}`, so the letters can appear without
    // the path being a URL.
    expect(isCrawledPagePath("abc123/http-notes.pdf")).toBe(false);
  });

  it("does not throw on a missing path", () => {
    expect(isCrawledPagePath(null)).toBe(false);
    expect(isCrawledPagePath(undefined)).toBe(false);
  });
});

describe("excludeCrawledPages", () => {
  it("renders as a negated prefix match on storage_path", () => {
    const { sql, params } = new PgDialect().sqlToQuery(excludeCrawledPages);
    expect(sql.replace(/\s+/g, " ")).toContain("storage_path");
    expect(sql.toLowerCase()).toContain("not");
    expect(sql.toLowerCase()).toContain("like");
    // Case-sensitive LIKE, not ILIKE: upload paths are always lowercase, and
    // LIKE can use the index.
    expect(sql.toLowerCase()).not.toContain("ilike");
    expect(params).toEqual(["http%"]);
  });
});
