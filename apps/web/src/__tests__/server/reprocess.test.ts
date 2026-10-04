/**
 * @jest-environment node
 *
 * Lazy reprocess runs on every chat turn. With processing capped at a few jobs
 * at a time, a queued file still reads `completed`, so these pin down that a
 * file is queued only by the turn that claims it, never again by the next.
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

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
  CURRENT_PROCESSING_VERSION: 2,
  processFile: jest.fn(),
}));
jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

const { maybeEnqueueReprocess } = await import("@/server/reprocess");

/** A db whose candidate select returns `candidates` and whose claim returns `claimed`. */
function mockDb(candidates: unknown[], claimed: unknown[]) {
  const update = jest.fn(() => ({
    set: () => ({
      where: () => ({ returning: () => Promise.resolve(claimed) }),
    }),
  }));
  const db = {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({ limit: () => Promise.resolve(candidates) }),
        }),
      }),
    }),
    update,
  };
  return { db: db as never, update };
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
});
