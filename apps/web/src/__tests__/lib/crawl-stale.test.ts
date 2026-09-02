import { jest, describe, it, expect } from "@jest/globals";

// Under ESM, `jest.mock` factories are silently ignored -- only
// `unstable_mockModule` actually replaces a module, and it requires the module
// under test to be imported dynamically afterwards. crawl-stale takes its db
// handle as a parameter and imports the type only, so the logger is the sole
// module that needs replacing here.
jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

const { logError } = await import("@/lib/logger");
const {
  isStalePreCrawl,
  isStaleCrawl,
  sweepStaleCrawls,
  STALE_PRE_CRAWL_MS,
  STALE_CRAWL_MS,
} = await import("@/server/crawl-stale");

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

/**
 * Minimal chainable stand-in for the drizzle query builder. Each `select()`
 * starts a new query that resolves to the next scripted response, whatever
 * combination of .from/.where/.groupBy it is awaited through.
 */
function fakeDb(responses: unknown[][]) {
  const updatedTables: unknown[] = [];
  let queryIndex = 0;

  const makeSelect = () => {
    const index = queryIndex++;
    const query: Record<string, unknown> = {};
    const self = () => query;
    query.from = self;
    query.where = self;
    query.groupBy = self;
    query.for = self;
    query.then = (onOk: (v: unknown) => unknown, onErr?: () => unknown) =>
      Promise.resolve(responses[index] ?? []).then(onOk, onErr);
    return query;
  };

  const makeUpdate = (table: unknown) => {
    updatedTables.push(table);
    const query: Record<string, unknown> = {};
    const self = () => query;
    query.set = self;
    query.where = self;
    query.returning = self;
    query.then = (onOk: (v: unknown) => unknown, onErr?: () => unknown) =>
      Promise.resolve([{ id: "s1" }]).then(onOk, onErr);
    return query;
  };

  return {
    db: {
      select: makeSelect,
      update: makeUpdate,
    } as unknown as Parameters<typeof sweepStaleCrawls>[0]["db"],
    updatedTables,
  };
}

describe("sweepStaleCrawls", () => {
  it("swallows a database failure so the list read it fronts still succeeds", async () => {
    const db = {
      select: () => {
        throw new Error("connection terminated");
      },
    } as unknown as Parameters<typeof sweepStaleCrawls>[0]["db"];

    await expect(
      sweepStaleCrawls({ db, userId: "user-1", now: NOW }),
    ).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("does no writes when nothing looks stale", async () => {
    const { db, updatedTables } = fakeDb([[]]);

    await sweepStaleCrawls({ db, userId: "user-1", now: NOW });

    expect(updatedTables).toHaveLength(0);
    expect(logError).not.toHaveBeenCalled();
  });

  it("spares a crawling source whose pages are still being touched", async () => {
    // The source transitioned to `crawling` hours ago, so it clears the SQL
    // candidate filter, but its pages moved a minute ago. Reaping it would kill
    // a working crawl. This is the case a broken page-activity lookup breaks:
    // if the query returns nothing, the fallback condemns the source.
    const { db, updatedTables } = fakeDb([
      [{ id: "s1", status: "crawling", updatedAt: minutesAgo(240) }],
      [{ crawlSourceId: "s1", lastActivityAt: minutesAgo(1) }],
    ]);

    await sweepStaleCrawls({ db, userId: "user-1", now: NOW });

    expect(updatedTables).toHaveLength(0);
  });

  it("reaps a crawling source whose pages went quiet", async () => {
    const { db, updatedTables } = fakeDb([
      [{ id: "s1", status: "crawling", updatedAt: minutesAgo(240) }],
      [{ crawlSourceId: "s1", lastActivityAt: minutesAgo(45) }],
    ]);

    await sweepStaleCrawls({ db, userId: "user-1", now: NOW });

    // Settles the source and fails its in-flight pages.
    expect(updatedTables.length).toBeGreaterThan(0);
  });
});
