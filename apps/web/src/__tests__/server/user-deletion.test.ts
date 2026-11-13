/**
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Prevent real DB/env from throwing during transitive module loading
process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const mockRemoveStoredFiles =
  jest.fn<(storagePaths: readonly string[]) => Promise<void>>();
const mockSendAccountDeletedEmail = jest.fn<() => Promise<void>>();
const mockLogInfo = jest.fn();
const mockLogError = jest.fn();

// Use unstable_mockModule for ESM compatibility
jest.unstable_mockModule("@/server/storage-removal", () => ({
  removeStoredFiles: mockRemoveStoredFiles,
}));

jest.unstable_mockModule("@/server/email", () => ({
  sendAccountDeletedEmail: mockSendAccountDeletedEmail,
  sendAdminNotificationEmail: jest.fn(),
  sendApprovalEmail: jest.fn(),
  sendRejectionEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendPromoteToAdminEmail: jest.fn(),
  sendDemoteFromAdminEmail: jest.fn(),
  sendAccountDisabledEmail: jest.fn(),
  sendAccountEnabledEmail: jest.fn(),
}));

jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: mockLogInfo,
  logError: mockLogError,
  logWarn: jest.fn(),
  logDebug: jest.fn(),
}));

// Dynamic import AFTER mocks are registered
const { deleteUserAccount, storagePathsToRemove, StorageCleanupError } =
  await import("@/server/services/user-deletion");

type Db = Parameters<typeof deleteUserAccount>[0];

// Helper to create a mock db with chainable methods
function createMockDb(files: Array<{ storagePath: string }> = []) {
  const selectWhere = jest.fn().mockResolvedValue(files);
  const selectFrom = jest.fn().mockReturnValue({ where: selectWhere });
  const select = jest.fn().mockReturnValue({ from: selectFrom });

  // Transaction-internal chains (used by tx inside db.transaction callback)
  const txUpdateWhere = jest.fn().mockResolvedValue(undefined);
  const txUpdateSet = jest.fn().mockReturnValue({ where: txUpdateWhere });
  const txUpdate = jest.fn().mockReturnValue({ set: txUpdateSet });

  const txDeleteWhere = jest.fn().mockResolvedValue(undefined);
  const txDeleteFn = jest.fn().mockReturnValue({ where: txDeleteWhere });

  // db.transaction(async (tx) => { ... }) -- executes the callback with a mock tx
  const transaction = jest.fn(async (cb: (tx: unknown) => Promise<void>) => {
    await cb({ update: txUpdate, delete: txDeleteFn });
  });

  // Writes outside the transaction would also delete data; none may happen.
  const deleteFn = jest.fn();
  const update = jest.fn();

  return {
    select,
    transaction,
    delete: deleteFn,
    update,
    _chains: {
      selectWhere,
      selectFrom,
      txUpdateWhere,
      txUpdateSet,
      txUpdate,
      txDeleteWhere,
      txDeleteFn,
    },
  };
}

describe("storagePathsToRemove", () => {
  it("keeps uploaded files and drops crawled pages", () => {
    expect(
      storagePathsToRemove([
        { storagePath: "user-123/file-1" },
        { storagePath: "https://example.edu/syllabus" },
        { storagePath: "user-123/file-2" },
        { storagePath: "http://example.edu/notes" },
      ]),
    ).toEqual(["user-123/file-1", "user-123/file-2"]);
  });
});

describe("deleteUserAccount", () => {
  const baseParams = {
    userId: "user-123",
    email: "test@university.edu",
    name: "Test User",
  };

  beforeEach(() => {
    mockRemoveStoredFiles.mockResolvedValue(undefined);
    mockSendAccountDeletedEmail.mockResolvedValue(undefined);
  });

  it("deletes the user from the database inside a transaction", async () => {
    const db = createMockDb();
    await deleteUserAccount(db as unknown as Db, baseParams);
    expect(db.transaction).toHaveBeenCalled();
    expect(db._chains.txDeleteFn).toHaveBeenCalled();
    expect(db._chains.txDeleteWhere).toHaveBeenCalled();
  });

  it("nullifies approved_domains.created_by references inside transaction", async () => {
    const db = createMockDb();
    await deleteUserAccount(db as unknown as Db, baseParams);
    expect(db._chains.txUpdate).toHaveBeenCalled();
    expect(db._chains.txUpdateSet).toHaveBeenCalledWith({ createdBy: null });
  });

  it("removes the user's stored files before the database transaction", async () => {
    const files = [
      { storagePath: "user-123/file1" },
      { storagePath: "user-123/file2" },
    ];
    const db = createMockDb(files);
    await deleteUserAccount(db as unknown as Db, baseParams);

    expect(mockRemoveStoredFiles).toHaveBeenCalledWith([
      "user-123/file1",
      "user-123/file2",
    ]);
    const removedAt = mockRemoveStoredFiles.mock.invocationCallOrder[0];
    const transactionAt = db.transaction.mock.invocationCallOrder[0];
    expect(removedAt).toBeLessThan(transactionAt!);
  });

  it("never passes crawled-page URLs to storage removal", async () => {
    const db = createMockDb([
      { storagePath: "user-123/file1" },
      { storagePath: "https://example.edu/page" },
      { storagePath: "user-123/file2" },
      { storagePath: "http://example.edu/other" },
    ]);
    await deleteUserAccount(db as unknown as Db, baseParams);

    expect(mockRemoveStoredFiles).toHaveBeenCalledTimes(1);
    const [paths] = mockRemoveStoredFiles.mock.calls[0]!;
    expect(paths).toEqual(["user-123/file1", "user-123/file2"]);
    expect(paths.some((p) => p.startsWith("http"))).toBe(false);
  });

  it("aborts with a retryable error and touches no data when storage cleanup fails", async () => {
    mockRemoveStoredFiles.mockRejectedValue(new Error("Storage error"));
    const db = createMockDb([{ storagePath: "user-123/file1" }]);

    const deletion = deleteUserAccount(db as unknown as Db, baseParams);
    await expect(deletion).rejects.toBeInstanceOf(StorageCleanupError);
    await expect(deletion).rejects.toThrow(
      "Couldn't remove your files — please try again",
    );

    // The user row (and through its cascade, chatbots and files) is only
    // deleted inside the transaction, so it never running leaves them intact.
    expect(db.transaction).not.toHaveBeenCalled();
    expect(db._chains.txDeleteFn).not.toHaveBeenCalled();
    expect(db._chains.txUpdate).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(mockSendAccountDeletedEmail).not.toHaveBeenCalled();
  });

  it("keeps the storage failure as the cause for logging", async () => {
    const storageError = new Error("Storage error");
    mockRemoveStoredFiles.mockRejectedValue(storageError);
    const db = createMockDb([{ storagePath: "user-123/file1" }]);

    const error = await deleteUserAccount(db as unknown as Db, baseParams).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(StorageCleanupError);
    expect((error as Error).cause).toBe(storageError);
  });

  it("succeeds when retried after a failed storage cleanup", async () => {
    const db = createMockDb([{ storagePath: "user-123/file1" }]);
    mockRemoveStoredFiles.mockRejectedValueOnce(new Error("Storage error"));

    await expect(
      deleteUserAccount(db as unknown as Db, baseParams),
    ).rejects.toBeInstanceOf(StorageCleanupError);
    await deleteUserAccount(db as unknown as Db, baseParams);

    expect(mockRemoveStoredFiles).toHaveBeenCalledTimes(2);
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it("sends confirmation email after successful deletion", async () => {
    const db = createMockDb();
    await deleteUserAccount(db as unknown as Db, baseParams);
    expect(mockSendAccountDeletedEmail).toHaveBeenCalledWith({
      email: "test@university.edu",
      name: "Test User",
    });
  });

  it("does not throw if confirmation email fails", async () => {
    mockSendAccountDeletedEmail.mockRejectedValueOnce(
      new Error("Email send failed"),
    );
    const db = createMockDb();
    await deleteUserAccount(db as unknown as Db, baseParams);
    expect(mockLogError).toHaveBeenCalled();
  });

  it("includes deletedBy in logs when provided", async () => {
    const db = createMockDb();
    await deleteUserAccount(db as unknown as Db, {
      ...baseParams,
      deletedBy: "admin-456",
    });
    expect(mockLogInfo).toHaveBeenCalledWith(
      "Starting user deletion",
      expect.objectContaining({ deletedBy: "admin-456" }),
    );
  });

  it("omits deletedBy from logs when not provided", async () => {
    const db = createMockDb();
    await deleteUserAccount(db as unknown as Db, baseParams);
    expect(mockLogInfo).toHaveBeenCalledWith(
      "Starting user deletion",
      expect.not.objectContaining({ deletedBy: expect.anything() }),
    );
  });

  it("propagates database errors", async () => {
    const db = createMockDb();
    db._chains.txDeleteWhere.mockRejectedValue(new Error("DB connection lost"));
    await expect(
      deleteUserAccount(db as unknown as Db, baseParams),
    ).rejects.toThrow("DB connection lost");
  });
});
