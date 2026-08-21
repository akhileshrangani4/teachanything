import { describe, it, expect } from "@jest/globals";
import {
  isStaleFile,
  lastFileActivityAt,
  staleFileError,
  STALE_PENDING_ERROR,
  STALE_PENDING_MS,
  STALE_PROCESSING_ERROR,
  STALE_PROCESSING_MS,
} from "@/lib/file-stale";

const NOW = new Date("2026-08-19T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const iso = (ms: number) => ago(ms).toISOString();

describe("lastFileActivityAt", () => {
  it("prefers lastUpdatedAt, the stamp every progress write refreshes", () => {
    expect(
      lastFileActivityAt({
        metadata: {
          processingProgress: {
            startedAt: iso(60 * 60_000),
            lastUpdatedAt: iso(60_000),
          },
        },
        createdAt: ago(2 * 60 * 60_000),
      }),
    ).toEqual(ago(60_000));
  });

  it("falls back to startedAt, then to createdAt", () => {
    expect(
      lastFileActivityAt({
        metadata: { processingProgress: { startedAt: iso(60_000) } },
        createdAt: ago(60 * 60_000),
      }),
    ).toEqual(ago(60_000));

    expect(
      lastFileActivityAt({ metadata: {}, createdAt: ago(60_000) }),
    ).toEqual(ago(60_000));
    expect(
      lastFileActivityAt({ metadata: null, createdAt: ago(60_000) }),
    ).toEqual(ago(60_000));
  });

  it("ignores an unparseable stamp rather than throwing", () => {
    expect(
      lastFileActivityAt({
        metadata: { processingProgress: { lastUpdatedAt: "not a date" } },
        createdAt: ago(60_000),
      }),
    ).toEqual(ago(60_000));
  });
});

describe("isStaleFile", () => {
  const check = (over: Partial<Parameters<typeof isStaleFile>[0]>) =>
    isStaleFile({
      status: "processing",
      metadata: {},
      createdAt: ago(60_000),
      now: NOW,
      ...over,
    });

  it("leaves settled files alone", () => {
    for (const status of ["completed", "failed"]) {
      expect(check({ status, createdAt: ago(24 * 60 * 60_000) })).toBe(false);
    }
  });

  it("keeps a file that is still reporting progress", () => {
    // The shape the bug produced: minutes into a big embed, but still alive.
    expect(
      check({
        metadata: {
          processingProgress: {
            startedAt: iso(STALE_PROCESSING_MS * 3),
            lastUpdatedAt: iso(30_000),
          },
        },
        createdAt: ago(STALE_PROCESSING_MS * 3),
      }),
    ).toBe(false);
  });

  it("times out a processing file whose worker went silent", () => {
    expect(
      check({
        metadata: {
          processingProgress: { lastUpdatedAt: iso(STALE_PROCESSING_MS + 1) },
        },
      }),
    ).toBe(true);
  });

  it("judges a processing file with no progress write by createdAt", () => {
    expect(check({ createdAt: ago(STALE_PROCESSING_MS + 1) })).toBe(true);
    expect(check({ createdAt: ago(STALE_PROCESSING_MS - 1) })).toBe(false);
  });

  it("times out a pending file whose job never arrived", () => {
    expect(
      check({ status: "pending", createdAt: ago(STALE_PENDING_MS + 1) }),
    ).toBe(true);
    expect(
      check({ status: "pending", createdAt: ago(STALE_PENDING_MS - 1) }),
    ).toBe(false);
  });

  it("spares a re-queued file whose upload is old but whose retry is fresh", () => {
    // `files.retry` flips an existing file back to `pending` and stamps the
    // queue time; `createdAt` still points at the original upload. Dating this
    // from `createdAt` swept every retried file straight back to `failed` --
    // and the retry mutation refetches `files.list`, which runs the sweep, so
    // the failure landed before the job could even start.
    expect(
      check({
        status: "pending",
        metadata: {
          processingProgress: { startedAt: iso(0), lastUpdatedAt: iso(0) },
        },
        createdAt: ago(7 * 24 * 60 * 60_000),
      }),
    ).toBe(false);
  });

  it("still times out a re-queued file whose job never ran", () => {
    expect(
      check({
        status: "pending",
        metadata: {
          processingProgress: {
            startedAt: iso(STALE_PENDING_MS + 1),
            lastUpdatedAt: iso(STALE_PENDING_MS + 1),
          },
        },
        createdAt: ago(7 * 24 * 60 * 60_000),
      }),
    ).toBe(true);
  });
});

describe("staleFileError", () => {
  it("explains which stage was abandoned and points at Retry", () => {
    expect(staleFileError("pending")).toBe(STALE_PENDING_ERROR);
    expect(staleFileError("processing")).toBe(STALE_PROCESSING_ERROR);
    expect(staleFileError("pending")).toContain("Retry");
    expect(staleFileError("processing")).toContain("Retry");
  });
});
