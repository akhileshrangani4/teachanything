/**
 * @jest-environment node
 *
 * Retry is the paid-path escape hatch: a v3-completed file whose visual
 * refresh failed must actually reprocess when a user explicitly retries it.
 * That means the published QStash job has to carry `force: true` — without it
 * processFile's completed-version skip guard silently no-ops the retry while
 * the UI reports success. These run the REAL publishFileProcessingJob against
 * a captured QStash client so the assertion covers the wire body.
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { initTRPC } from "@trpc/server";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const USER_ID = "user-1";
const FILE_ID = "6f1c1d8e-2b4a-4c1e-9a43-0f2d6c9b7a11";

type Published = { url: string; body: Record<string, unknown> };
const published: Published[] = [];

jest.unstable_mockModule("@upstash/qstash", () => ({
  Client: class {
    publishJSON(params: { url: string; body: unknown }) {
      published.push({
        url: params.url,
        body: params.body as Record<string, unknown>,
      });
      return Promise.resolve({ messageId: "m-1" });
    }
  },
  Receiver: class {},
}));

// Stand-in for the real procedure, minus the session/approval middleware,
// which is not what these tests are about.
const t = initTRPC.context<{ db: unknown; session: unknown }>().create();

jest.unstable_mockModule("@/server/trpc", () => ({
  protectedProcedure: t.procedure,
}));
jest.unstable_mockModule("@/lib/env", () => ({
  isServiceAvailable: () => true,
  env: {
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    QSTASH_TOKEN: "test-token",
  },
}));
jest.unstable_mockModule("@/server/file-processor", () => ({
  CURRENT_PROCESSING_VERSION: 3,
  processFile: jest.fn(),
}));
jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

const { retryProcedure } =
  await import("@/server/routers/files/procedures/retry");

const createCaller = t.createCallerFactory(t.router({ retry: retryProcedure }));

/** A completed v3 file whose visual refresh failed; old index still usable. */
const refreshFailedFile = {
  id: FILE_ID,
  userId: USER_ID,
  fileName: "week3-slides.pdf",
  processingStatus: "completed",
  metadata: {
    processingVersion: 3,
    refreshWarning: "Visual refresh failed; showing the previous analysis",
    refreshFailedAt: "2026-10-21T00:00:00.000Z",
  },
};

/** A db returning `file` from the ownership select, plus caller context. */
function mockCtx(file: unknown) {
  const update = jest.fn(() => ({
    set: () => ({ where: () => Promise.resolve() }),
  }));
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(file ? [file] : []) }),
      }),
    }),
    update,
  };
  return { db: db as never, session: { user: { id: USER_ID } } };
}

beforeEach(() => {
  published.length = 0;
});

describe("retryProcedure", () => {
  it("publishes the processing job with force so a failed refresh actually reprocesses", async () => {
    const caller = createCaller(mockCtx(refreshFailedFile));

    await caller.retry({ fileId: FILE_ID });

    expect(published).toHaveLength(1);
    expect(published[0].url).toContain("/api/jobs/process-file");
    expect(published[0].body).toEqual({ fileId: FILE_ID, force: true });
  });

  it("refuses to retry a healthy completed file and publishes nothing", async () => {
    const caller = createCaller(
      mockCtx({
        ...refreshFailedFile,
        metadata: { processingVersion: 3 },
      }),
    );

    await expect(caller.retry({ fileId: FILE_ID })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(published).toHaveLength(0);
  });
});
