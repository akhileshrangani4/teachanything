/**
 * @jest-environment node
 *
 * Lazy reprocess runs on every chat turn. With processing capped at a few jobs
 * at a time, a queued file still reads `completed`, so these pin down that a
 * file is queued only by the turn that claims it, never again by the next.
 * They also pin the anti-double-spend guard: a file whose paid visual refresh
 * failed must be excluded from auto claims, so chatting cannot recharge it.
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const mockPublish = jest.fn<() => Promise<{ messageId: string }>>();

jest.unstable_mockModule("@/lib/env", () => ({
  env: { NODE_ENV: "production" },
}));
jest.unstable_mockModule("@/server/qstash", () => ({
  publishFileProcessingJob: mockPublish,
}));
jest.unstable_mockModule("@/server/file-processor", () => ({
  CURRENT_PROCESSING_VERSION: 3,
  processFile: jest.fn(),
}));
const mockLogInfo = jest.fn<() => void>();
const mockLogError = jest.fn<() => void>();

jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: mockLogInfo,
  logError: mockLogError,
}));

const { maybeEnqueueReprocess } = await import("@/server/reprocess");

/** Renders a captured drizzle condition to SQL text. */
function renderSql(condition: unknown): string {
  return new PgDialect().sqlToQuery(condition as SQL).sql;
}

/**
 * A db whose candidate select returns `candidates` and whose claim returns
 * `claimed`, capturing both where clauses for guard assertions.
 */
function mockDb(candidates: unknown[], claimed: unknown[]) {
  let candidateWhere: unknown;
  let claimWhere: unknown;
  const sets: unknown[] = [];
  const update = jest.fn(() => ({
    set: (payload: unknown) => {
      sets.push(payload);
      return {
        where: (where: unknown) => {
          claimWhere = where;
          return { returning: () => Promise.resolve(claimed) };
        },
      };
    },
  }));
  const db = {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: (where: unknown) => {
            candidateWhere = where;
            return { limit: () => Promise.resolve(candidates) };
          },
        }),
      }),
    }),
    update,
  };
  return {
    db: db as never,
    update,
    sets,
    wheres: () => ({ candidateWhere, claimWhere }),
  };
}

beforeEach(() => {
  mockPublish.mockReset().mockResolvedValue({ messageId: "m-1" });
});

describe("maybeEnqueueReprocess", () => {
  it("queues only the files this turn claimed, under their owner", async () => {
    const { db } = mockDb(
      [{ fileId: "f1" }, { fileId: "f2" }],
      // f2 was claimed by a concurrent turn between the select and the update.
      [{ fileId: "f1", userId: "owner-1" }],
    );

    await maybeEnqueueReprocess(db, "bot-1");

    expect(mockPublish).toHaveBeenCalledTimes(1);
    expect(mockPublish).toHaveBeenCalledWith({
      fileId: "f1",
      userId: "owner-1",
    });
  });

  it("queues nothing when every candidate was already claimed", async () => {
    const { db } = mockDb([{ fileId: "f1" }], []);

    await maybeEnqueueReprocess(db, "bot-1");

    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("skips the claim entirely when nothing is out of date", async () => {
    const { db, update } = mockDb([], []);

    await maybeEnqueueReprocess(db, "bot-1");

    expect(update).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("excludes files with a failed visual refresh from auto claims", async () => {
    const { db, wheres } = mockDb(
      [{ fileId: "f1" }],
      [{ fileId: "f1", userId: "owner-1" }],
    );

    await maybeEnqueueReprocess(db, "bot-1");

    // The refreshFailedAt guard is load-bearing in both places: the candidate
    // select (what chat access picks up) and the batch claim (what actually
    // re-queues). Without it, every chat access re-charges a failed paid
    // refresh while the old index is still usable.
    const { candidateWhere, claimWhere } = wheres();
    expect(renderSql(candidateWhere)).toContain("refreshFailedAt");
    expect(renderSql(candidateWhere)).toContain("is null");
    expect(renderSql(claimWhere)).toContain("refreshFailedAt");
    expect(renderSql(claimWhere)).toContain("is null");
  });

  it("releases the claim when publishing fails and keeps the batch alive", async () => {
    const { db, update, sets } = mockDb(
      [{ fileId: "f1" }, { fileId: "f2" }],
      [
        { fileId: "f1", userId: "owner-1" },
        { fileId: "f2", userId: "owner-2" },
      ],
    );
    mockPublish.mockRejectedValueOnce(new Error("qstash down"));

    await maybeEnqueueReprocess(db, "bot-1");

    // f1's publish failed (call 1) and f2 still went out (call 2): the batch
    // survived the failure.
    expect(mockPublish).toHaveBeenCalledTimes(2);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.anything(),
      "Failed to enqueue reprocess job",
      { fileId: "f1" },
    );
    // The rollback drops reprocessQueuedAt so a later chat turn can claim f1
    // again instead of losing it for the requeue window.
    expect(update).toHaveBeenCalledTimes(2);
    expect(sets).toHaveLength(2);
    expect(renderSql((sets[1] as { metadata: unknown }).metadata)).toContain(
      "- 'reprocessQueuedAt'",
    );
  });

  it("swallows selection failures instead of failing the chat turn", async () => {
    const db = {
      select: () => {
        throw new Error("db down");
      },
    } as never;

    await expect(maybeEnqueueReprocess(db, "bot-1")).resolves.toBeUndefined();
    expect(mockLogError).toHaveBeenCalledWith(
      expect.anything(),
      "maybeEnqueueReprocess failed",
      { chatbotId: "bot-1" },
    );
  });
});
