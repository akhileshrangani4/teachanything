/**
 * @jest-environment node
 *
 * A file in Storage with no user_files row pointing at it is never deleted by
 * anything. These cover the two server paths that used to leave one behind:
 * deleting the row after Storage refused to delete the file, and failing
 * finalizeUpload after the file had already been uploaded.
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { initTRPC } from "@trpc/server";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const USER_ID = "user-1";
const FILE_ID = "6f1c1d8e-2b4a-4c1e-9a43-0f2d6c9b7a11";
const OWN_PATH = `${USER_ID}/${FILE_ID}`;

type StorageResult = { data: unknown; error: unknown };
const mockRemove = jest.fn<(paths: string[]) => Promise<StorageResult>>();
const mockList = jest.fn<() => Promise<StorageResult>>();

// Stand-in for the real procedures, minus the session/approval middleware,
// which is not what these tests are about.
const t = initTRPC.context<{ db: unknown; session: unknown }>().create();

jest.unstable_mockModule("@/server/trpc", () => ({
  protectedProcedure: t.procedure,
}));
jest.unstable_mockModule("@/lib/env", () => ({
  isServiceAvailable: () => true,
  env: { NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "http://localhost" },
}));
jest.unstable_mockModule("@/server/supabase", () => ({
  createSupabaseClient: () => ({
    storage: {
      from: () => ({
        remove: (paths: string[]) => mockRemove(paths),
        list: () => mockList(),
      }),
    },
  }),
}));
jest.unstable_mockModule("@/server/local-storage", () => ({
  deleteLocalFile: jest.fn(),
  localFileExists: jest.fn(),
  getLocalFileSize: jest.fn(),
}));
jest.unstable_mockModule("@/server/qstash", () => ({
  publishFileProcessingJob: jest.fn(),
}));
jest.unstable_mockModule("@/server/file-processor", () => ({
  processFile: jest.fn(),
}));
jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

const { deleteProcedure } =
  await import("@/server/routers/files/procedures/delete");
const { finalizeUploadProcedure } =
  await import("@/server/routers/files/procedures/finalize-upload");

const createCaller = t.createCallerFactory(
  t.router({ delete: deleteProcedure, finalize: finalizeUploadProcedure }),
);

/**
 * A db whose selects return `selects` in call order (then nothing), and whose
 * insert throws `insertError`.
 */
function createMockDb(selects: unknown[][], insertError?: Error) {
  const pending = [...selects];
  const deleteWhere = jest.fn<() => Promise<void>>().mockResolvedValue();
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(pending.shift() ?? []),
        }),
      }),
    }),
    delete: jest.fn(() => ({ where: deleteWhere })),
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: () =>
            insertError ? Promise.reject(insertError) : Promise.resolve([]),
        }),
      }),
    }),
  };
  return db;
}

function callerFor(db: ReturnType<typeof createMockDb>) {
  return createCaller({ db, session: { user: { id: USER_ID } } });
}

const finalizeInput = {
  fileId: FILE_ID,
  fileName: "notes.pdf",
  fileType: "application/pdf",
  fileSize: 1000,
  storagePath: OWN_PATH,
};

beforeEach(() => {
  mockRemove.mockReset().mockResolvedValue({ data: [], error: null });
  mockList.mockReset().mockResolvedValue({
    data: [{ name: FILE_ID, metadata: { size: 1000 } }],
    error: null,
  });
});

describe("files.delete", () => {
  const file = { id: FILE_ID, userId: USER_ID, storagePath: OWN_PATH };

  it("keeps the database row when Storage fails to delete the file", async () => {
    mockRemove.mockResolvedValue({
      data: null,
      error: new Error("storage down"),
    });
    const db = createMockDb([[file]]);

    await expect(callerFor(db).delete({ fileId: FILE_ID })).rejects.toThrow(
      "Failed to delete file",
    );
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("deletes the database row once Storage has deleted the file", async () => {
    const db = createMockDb([[file]]);

    await expect(callerFor(db).delete({ fileId: FILE_ID })).resolves.toEqual({
      success: true,
    });
    expect(mockRemove).toHaveBeenCalledWith([OWN_PATH]);
    expect(db.delete).toHaveBeenCalled();
  });
});

describe("files.finalizeUpload", () => {
  it("deletes the uploaded file once every insert attempt has failed", async () => {
    jest.useFakeTimers();
    try {
      const db = createMockDb([], new Error("connection lost"));

      const finalize = callerFor(db).finalize(finalizeInput);
      const settled = expect(finalize).rejects.toThrow(
        "Failed to finalize file upload",
      );
      // Run through the retry backoff without waiting for it.
      await jest.advanceTimersByTimeAsync(10_000);
      await settled;
      expect(mockRemove).toHaveBeenCalledWith([OWN_PATH]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("deletes the uploaded file when the name is already taken", async () => {
    // No row of its own yet, then another file with the same name.
    const db = createMockDb([[], [{ id: "existing" }]]);

    await expect(callerFor(db).finalize(finalizeInput)).rejects.toThrow(
      "already exists",
    );
    expect(mockRemove).toHaveBeenCalledWith([OWN_PATH]);
  });

  it("never deletes a path that belongs to someone else", async () => {
    const db = createMockDb([]);
    const otherPath = `someone-else/${FILE_ID}`;

    await expect(
      callerFor(db).finalize({ ...finalizeInput, storagePath: otherPath }),
    ).rejects.toThrow("Invalid storage path");
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
