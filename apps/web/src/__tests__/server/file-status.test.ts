/**
 * @jest-environment node
 *
 * The pipeline's status/metadata helpers. updateProgress's cleanup list is the
 * contract that keeps stale failure markers (error, refreshWarning,
 * refreshFailedAt) from surviving into a fresh processing run;
 * abandonProcessing is the settle-fast path for mid-run bails that would
 * otherwise leave a permanently claimed `processing` row.
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

let currentRow: { metadata: Record<string, unknown> } | undefined;
let lastSet: unknown;

const update = jest.fn(
  (): {
    set: (payload: unknown) => { where: () => Promise<void> };
  } => {
    throw new Error("update used before its test set an implementation");
  },
);

jest.unstable_mockModule("@teachanything/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (currentRow ? [currentRow] : []),
        }),
      }),
    }),
    update,
  },
}));
const mockLogError = jest.fn<() => void>();
jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: jest.fn<() => void>(),
  logError: mockLogError,
}));

const { abandonProcessing, updateProgress } =
  await import("@/server/file-processor/file-status");

beforeEach(() => {
  currentRow = undefined;
  lastSet = undefined;
  update.mockImplementation(
    () =>
      ({
        set: (payload: unknown) => {
          lastSet = payload;
          return { where: () => Promise.resolve() };
        },
      }) as never,
  );
});

describe("abandonProcessing", () => {
  it("settles the row as failed with the real reason", async () => {
    const result = await abandonProcessing(
      "file-1",
      "Office document contains no readable content",
    );

    expect(result).toEqual({ success: false, chunkCount: 0 });
    expect(lastSet).toEqual({
      processingStatus: "failed",
      metadata: { error: "Office document contains no readable content" },
    });
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it("still settles when the status write itself fails", async () => {
    update.mockImplementationOnce(() => {
      throw new Error("connection refused");
    });

    const result = await abandonProcessing("file-1", "vision refresh failed");

    expect(result).toEqual({ success: false, chunkCount: 0 });
    expect(mockLogError).toHaveBeenCalledWith(
      expect.anything(),
      "Failed to mark abandoned file as failed",
      { fileId: "file-1" },
    );
  });
});

describe("updateProgress", () => {
  it("strips stale failure markers and clamps the percentage", async () => {
    currentRow = {
      metadata: {
        error: "old failure",
        refreshWarning: "stale",
        refreshFailedAt: "stale",
        sourceName: "keep-me",
        processingProgress: { startedAt: "2026-01-01T00:00:00.000Z" },
      },
    };

    await updateProgress("file-1", "analyzing", 150, 3, 12);

    const metadata = (lastSet as { metadata: Record<string, unknown> })
      .metadata;
    expect(metadata).toMatchObject({
      sourceName: "keep-me",
      processingProgress: {
        stage: "analyzing",
        percentage: 100,
        currentChunk: 3,
        totalChunks: 12,
        startedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    // A new run must not inherit the old run's failure markers:
    // refreshFailedAt and refreshWarning only mean something while the old
    // index is the one being served.
    expect(metadata.error).toBeUndefined();
    expect(metadata.refreshWarning).toBeUndefined();
    expect(metadata.refreshFailedAt).toBeUndefined();
  });

  it("starts a fresh clock when no prior progress exists", async () => {
    currentRow = undefined;

    await updateProgress("file-1", "downloading", -20);

    const metadata = (lastSet as { metadata: Record<string, unknown> })
      .metadata;
    expect(metadata.processingProgress).toMatchObject({
      stage: "downloading",
      percentage: 0,
    });
    expect(
      (metadata.processingProgress as { startedAt: string }).startedAt,
    ).toBeTruthy();
  });
});
