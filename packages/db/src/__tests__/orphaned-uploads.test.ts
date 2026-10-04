import { describe, it, expect } from "@jest/globals";
import {
  ORPHANED_UPLOADS_QUERY,
  chunk,
  formatOrphanReport,
  type OrphanedUpload,
} from "../orphaned-uploads";

const MB = 1024 * 1024;

function orphan(path: string, sizeMb: number, date: string): OrphanedUpload {
  return { path, size: sizeMb * MB, createdAt: new Date(date) };
}

describe("ORPHANED_UPLOADS_QUERY", () => {
  it("only looks at the upload bucket", () => {
    expect(ORPHANED_UPLOADS_QUERY).toContain("o.bucket_id = 'chatbot-files'");
  });

  it("skips objects young enough to still be mid-upload", () => {
    expect(ORPHANED_UPLOADS_QUERY).toContain(
      "o.created_at < now() - interval '24 hours'",
    );
  });

  it("keeps any object a user_files row points at", () => {
    expect(ORPHANED_UPLOADS_QUERY).toMatch(
      /NOT EXISTS \(\s*SELECT 1 FROM public\.user_files f WHERE f\.storage_path = o\.name\s*\)/,
    );
  });
});

describe("chunk", () => {
  it("splits into batches of the given size with a short last batch", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns no batches for an empty list", () => {
    expect(chunk([], 100)).toEqual([]);
  });

  it("rejects a size below 1 instead of looping forever", () => {
    expect(() => chunk([1], 0)).toThrow("chunk size must be at least 1");
  });
});

describe("formatOrphanReport", () => {
  it("says so when there is nothing to sweep", () => {
    expect(formatOrphanReport([])).toBe("No orphaned uploads found.");
  });

  it("totals the size and lists the largest files first", () => {
    const report = formatOrphanReport(
      [
        orphan("u1/small", 1, "2026-01-05"),
        orphan("u2/big", 40, "2026-08-03"),
        orphan("u1/mid", 9, "2026-02-24"),
      ],
      2,
    );

    expect(report).toBe(
      [
        "3 orphaned uploads, 50.0 MB total.",
        "Largest 2:",
        "  u2/big  40.0 MB  2026-08-03",
        "  u1/mid  9.0 MB  2026-02-24",
      ].join("\n"),
    );
  });
});
