import { jest, describe, it, expect } from "@jest/globals";

// crawl-stale imports the db client and logger at module scope; mock both so
// the pure staleness predicates can be exercised without a database.
jest.mock("@teachanything/db", () => ({ db: {} }));
jest.mock("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

const { isStalePreCrawl, isStaleCrawl, STALE_PRE_CRAWL_MS, STALE_CRAWL_MS } =
  await import("@/lib/crawl-stale");

const NOW = new Date("2026-08-16T12:00:00.000Z");

function minutesAgo(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60 * 1000);
}

describe("isStalePreCrawl", () => {
  it("flags a discovering source that has gone quiet past the threshold", () => {
    expect(
      isStalePreCrawl({
        status: "discovering",
        updatedAt: minutesAgo(20),
        now: NOW,
      }),
    ).toBe(true);
  });

  it("flags a pending source that never got picked up", () => {
    expect(
      isStalePreCrawl({
        status: "pending",
        updatedAt: minutesAgo(16),
        now: NOW,
      }),
    ).toBe(true);
  });

  it("leaves a source alone inside the threshold", () => {
    expect(
      isStalePreCrawl({
        status: "discovering",
        updatedAt: minutesAgo(5),
        now: NOW,
      }),
    ).toBe(false);
  });

  it("does not flag exactly at the threshold", () => {
    expect(
      isStalePreCrawl({
        status: "discovering",
        updatedAt: new Date(NOW.getTime() - STALE_PRE_CRAWL_MS),
        now: NOW,
      }),
    ).toBe(false);
  });

  it("ignores statuses it does not own", () => {
    for (const status of ["crawling", "completed", "failed"]) {
      expect(
        isStalePreCrawl({ status, updatedAt: minutesAgo(500), now: NOW }),
      ).toBe(false);
    }
  });
});

describe("isStaleCrawl", () => {
  it("flags a crawl whose pages stopped being touched", () => {
    expect(
      isStaleCrawl({
        status: "crawling",
        lastPageActivityAt: minutesAgo(45),
        updatedAt: minutesAgo(60),
        now: NOW,
      }),
    ).toBe(true);
  });

  it("keeps a long-running crawl alive while pages are still progressing", () => {
    // The source row only changes on status transitions, so an old updatedAt
    // must not by itself condemn a crawl that is visibly working.
    expect(
      isStaleCrawl({
        status: "crawling",
        lastPageActivityAt: minutesAgo(2),
        updatedAt: minutesAgo(240),
        now: NOW,
      }),
    ).toBe(false);
  });

  it("falls back to the source timestamp when discovery inserted no pages", () => {
    expect(
      isStaleCrawl({
        status: "crawling",
        lastPageActivityAt: null,
        updatedAt: minutesAgo(31),
        now: NOW,
      }),
    ).toBe(true);
    expect(
      isStaleCrawl({
        status: "crawling",
        lastPageActivityAt: null,
        updatedAt: minutesAgo(10),
        now: NOW,
      }),
    ).toBe(false);
  });

  it("does not flag exactly at the threshold", () => {
    expect(
      isStaleCrawl({
        status: "crawling",
        lastPageActivityAt: new Date(NOW.getTime() - STALE_CRAWL_MS),
        updatedAt: minutesAgo(60),
        now: NOW,
      }),
    ).toBe(false);
  });

  it("ignores statuses it does not own", () => {
    for (const status of ["pending", "discovering", "completed", "failed"]) {
      expect(
        isStaleCrawl({
          status,
          lastPageActivityAt: minutesAgo(500),
          updatedAt: minutesAgo(500),
          now: NOW,
        }),
      ).toBe(false);
    }
  });
});

describe("staleness thresholds", () => {
  it("gives discovery room beyond its own 3-minute in-process timeout", () => {
    expect(STALE_PRE_CRAWL_MS).toBeGreaterThan(3 * 60 * 1000);
  });

  it("is more patient with an in-flight crawl than with a stalled start", () => {
    expect(STALE_CRAWL_MS).toBeGreaterThan(STALE_PRE_CRAWL_MS);
  });
});
