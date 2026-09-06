import { describe, it, expect } from "@jest/globals";
import {
  isStaleFile,
  lastFileActivityAt,
  staleFileError,
  sweepStaleFiles,
  MAX_THROTTLE_ENTRIES,
  STALE_PENDING_ERROR,
  STALE_PENDING_MS,
  STALE_PROCESSING_ERROR,
  STALE_PROCESSING_MS,
} from "@/server/file-stale";

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
      storagePath: "user-1/file-1",
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

  it("never touches a crawled page, however old its row is", () => {
    // Crawled pages share `userFiles`, and `crawl-processor` flips one back to
    // `processing` on a re-crawl WITHOUT writing a progress stamp -- so this
    // predicate would date a live re-crawl from the day the page was first
    // crawled and fail it mid-flight. Worse, the message it writes tells the
    // owner to hit Retry, which queues a process-file job against a URL.
    for (const status of ["pending", "processing"]) {
      expect(
        check({
          status,
          storagePath: "https://example.edu/syllabus",
          createdAt: ago(30 * 24 * 60 * 60_000),
        }),
      ).toBe(false);
    }
    // http, not just https.
    expect(
      check({
        storagePath: "http://example.edu/syllabus",
        createdAt: ago(30 * 24 * 60 * 60_000),
      }),
    ).toBe(false);
    // An upload whose name merely starts with those letters is still swept.
    expect(
      check({
        storagePath: "user-1/https-notes.pdf",
        createdAt: ago(STALE_PROCESSING_MS + 1),
      }),
    ).toBe(true);
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

/**
 * Minimal chainable stand-in for the drizzle query builder, mirroring the one in
 * `crawl-stale.test.ts`. Each `select()` resolves to the next scripted response;
 * each `update()` records the payload it was handed.
 */
function fakeDb(responses: unknown[][]) {
  const updates: Array<Record<string, unknown>> = [];
  let queryIndex = 0;

  const makeSelect = () => {
    const index = queryIndex++;
    const query: Record<string, unknown> = {};
    const self = () => query;
    query.from = self;
    query.where = self;
    query.orderBy = self;
    query.limit = self;
    query.then = (onOk: (v: unknown) => unknown, onErr?: () => unknown) =>
      Promise.resolve(responses[index] ?? []).then(onOk, onErr);
    return query;
  };

  const makeUpdate = () => {
    const query: Record<string, unknown> = {};
    query.set = (values: Record<string, unknown>) => {
      updates.push(values);
      return query;
    };
    query.where = () => query;
    query.then = (onOk: (v: unknown) => unknown, onErr?: () => unknown) =>
      Promise.resolve([]).then(onOk, onErr);
    return query;
  };

  return {
    db: { select: makeSelect, update: makeUpdate } as unknown as Parameters<
      typeof sweepStaleFiles
    >[0]["db"],
    updates,
  };
}

let userSeq = 0;
/**
 * A fresh user id per test. `sweepStaleFiles` throttles per user in a
 * module-level map, so reusing an id would make one test's sweep suppress the
 * next one's.
 */
const freshUser = () => `user-${++userSeq}`;

const upload = (over: Record<string, unknown> = {}) => ({
  id: "f1",
  processingStatus: "processing",
  storagePath: "u/f1",
  metadata: {},
  createdAt: ago(STALE_PROCESSING_MS + 60_000),
  ...over,
});

describe("sweepStaleFiles", () => {
  it("swallows a database failure so the list read it fronts still succeeds", async () => {
    const db = {
      select: () => {
        throw new Error("connection terminated");
      },
    } as unknown as Parameters<typeof sweepStaleFiles>[0]["db"];

    await expect(
      sweepStaleFiles({ db, userId: freshUser(), now: NOW }),
    ).resolves.toBeUndefined();
  });

  it("does no writes when nothing is in progress", async () => {
    const { db, updates } = fakeDb([[]]);
    await sweepStaleFiles({ db, userId: freshUser(), now: NOW });
    expect(updates).toHaveLength(0);
  });

  it("does no writes when the in-progress files are still alive", async () => {
    const { db, updates } = fakeDb([
      [upload({ createdAt: ago(60_000) })],
      // A second response in case the implementation ever issues another read.
      [],
    ]);
    await sweepStaleFiles({ db, userId: freshUser(), now: NOW });
    expect(updates).toHaveLength(0);
  });

  it("fails a silent processing file with the processing message", async () => {
    const { db, updates } = fakeDb([[upload()]]);
    await sweepStaleFiles({ db, userId: freshUser(), now: NOW });
    expect(updates).toEqual([
      {
        processingStatus: "failed",
        metadata: { error: STALE_PROCESSING_ERROR },
      },
    ]);
  });

  it("fails a stuck pending file with the pending message", async () => {
    const { db, updates } = fakeDb([
      [
        upload({
          processingStatus: "pending",
          createdAt: ago(STALE_PENDING_MS + 60_000),
        }),
      ],
    ]);
    await sweepStaleFiles({ db, userId: freshUser(), now: NOW });
    expect(updates).toEqual([
      { processingStatus: "failed", metadata: { error: STALE_PENDING_ERROR } },
    ]);
  });

  it("writes one update per status, not one per file", async () => {
    const { db, updates } = fakeDb([
      [
        upload({ id: "a" }),
        upload({ id: "b" }),
        upload({
          id: "c",
          processingStatus: "pending",
          createdAt: ago(STALE_PENDING_MS + 60_000),
        }),
      ],
    ]);
    await sweepStaleFiles({ db, userId: freshUser(), now: NOW });
    expect(updates).toHaveLength(2);
    expect(updates.map((u) => u.metadata)).toEqual([
      { error: STALE_PENDING_ERROR },
      { error: STALE_PROCESSING_ERROR },
    ]);
  });

  it("leaves a crawled page alone even when its row is ancient", async () => {
    // The SQL predicate already excludes these; this covers the belt in
    // `isStaleFile` for a caller that hands the row over anyway.
    const { db, updates } = fakeDb([
      [
        upload({
          storagePath: "https://example.edu/syllabus",
          createdAt: ago(30 * 24 * 60 * 60_000),
        }),
      ],
    ]);
    await sweepStaleFiles({ db, userId: freshUser(), now: NOW });
    expect(updates).toHaveLength(0);
  });

  it("skips a repeat sweep inside the throttle window", async () => {
    const userId = freshUser();
    const first = fakeDb([[upload()]]);
    await sweepStaleFiles({ db: first.db, userId, now: NOW });
    expect(first.updates).toHaveLength(1);

    // The Files tab polls while a file processes; the second read must not
    // re-run the query.
    const second = fakeDb([[upload()]]);
    await sweepStaleFiles({
      db: second.db,
      userId,
      now: new Date(NOW.getTime() + 30_000),
    });
    expect(second.updates).toHaveLength(0);
  });

  it("sweeps again once the throttle window has passed", async () => {
    const userId = freshUser();
    const first = fakeDb([[upload()]]);
    await sweepStaleFiles({ db: first.db, userId, now: NOW });

    const later = fakeDb([[upload()]]);
    await sweepStaleFiles({
      db: later.db,
      userId,
      now: new Date(NOW.getTime() + 5 * 60_000),
    });
    expect(later.updates).toHaveLength(1);
  });

  it("does not throttle one user behind another", async () => {
    const a = fakeDb([[upload()]]);
    await sweepStaleFiles({ db: a.db, userId: freshUser(), now: NOW });
    const b = fakeDb([[upload()]]);
    await sweepStaleFiles({ db: b.db, userId: freshUser(), now: NOW });
    expect(b.updates).toHaveLength(1);
  });

  it("drops the throttle wholesale rather than growing without bound", async () => {
    // One entry per active user per instance, so this is not a shape production
    // reaches -- but an unbounded module-level map on a long-lived instance is
    // a leak, and clearing it only costs one extra sweep per active user.
    const pinned = freshUser();
    const first = fakeDb([[upload()]]);
    await sweepStaleFiles({ db: first.db, userId: pinned, now: NOW });
    expect(first.updates).toHaveLength(1);

    const empty = fakeDb([[]]);
    for (let i = 0; i < MAX_THROTTLE_ENTRIES; i++) {
      await sweepStaleFiles({
        db: empty.db,
        userId: `filler-${i}`,
        now: NOW,
      });
    }

    // The pinned user's entry went with the clear, so it sweeps again even
    // though it is still inside the interval.
    const again = fakeDb([[upload()]]);
    await sweepStaleFiles({ db: again.db, userId: pinned, now: NOW });
    expect(again.updates).toHaveLength(1);
  });

  it("retries after a failure instead of waiting out the throttle", async () => {
    const userId = freshUser();
    const broken = {
      select: () => {
        throw new Error("connection terminated");
      },
    } as unknown as Parameters<typeof sweepStaleFiles>[0]["db"];
    await sweepStaleFiles({ db: broken, userId, now: NOW });

    const retry = fakeDb([[upload()]]);
    await sweepStaleFiles({
      db: retry.db,
      userId,
      now: new Date(NOW.getTime() + 1_000),
    });
    expect(retry.updates).toHaveLength(1);
  });
});
