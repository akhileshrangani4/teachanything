/**
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Prevent real DB/env from throwing during transitive module loading
process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

// Mock hoisted functions
const mockRemove = jest
  .fn<() => Promise<{ error: unknown }>>()
  .mockResolvedValue({ error: null });
const mockIsServiceAvailable = jest.fn().mockReturnValue(false);
const mockSendAccountDeletedEmail = jest.fn().mockResolvedValue(undefined);
const mockLogInfo = jest.fn();
const mockLogError = jest.fn();

// Use unstable_mockModule for ESM compatibility
jest.unstable_mockModule("@/lib/env", () => ({
  isServiceAvailable: mockIsServiceAvailable,
  env: {
    ADMIN_EMAILS: "admin@test.edu",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_CONTACT_EMAIL: "support@test.edu",
    RESEND_FROM_EMAIL: "noreply@test.edu",
    ALLOWED_EMAIL_DOMAINS: ".edu",
    NODE_ENV: "test",
  },
  getAdminEmails: jest.fn().mockReturnValue(["admin@test.edu"]),
  getApprovedDomains: jest.fn().mockReturnValue([".edu"]),
  getMaxFileSizeBytes: jest.fn().mockReturnValue(50 * 1024 * 1024),
}));

jest.unstable_mockModule("@/lib/supabase", () => ({
  createSupabaseClient: () => ({
    storage: {
      from: () => ({ remove: (...args: unknown[]) => mockRemove(...args) }),
    },
  }),
}));

jest.unstable_mockModule("@/lib/email", () => ({
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
const { deleteUserAccount } = await import("@/server/services/user-deletion");

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

  return {
    select,
    transaction,
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

describe("deleteUserAccount", () => {
  const baseParams = {
    userId: "user-123",
    email: "test@university.edu",
    name: "Test User",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsServiceAvailable.mockReturnValue(false);
    mockRemove.mockResolvedValue({ error: null });
  });

  it("deletes the user from the database inside a transaction", async () => {
    const db = createMockDb();
    await deleteUserAccount(
      db as unknown as Parameters<typeof deleteUserAccount>[0],
      baseParams,
    );
    expect(db.transaction).toHaveBeenCalled();
    expect(db._chains.txDeleteFn).toHaveBeenCalled();
    expect(db._chains.txDeleteWhere).toHaveBeenCalled();
  });

  it("nullifies approved_domains.created_by references inside transaction", async () => {
    const db = createMockDb();
    await deleteUserAccount(
      db as unknown as Parameters<typeof deleteUserAccount>[0],
      baseParams,
    );
    expect(db._chains.txUpdate).toHaveBeenCalled();
    expect(db._chains.txUpdateSet).toHaveBeenCalledWith({ createdBy: null });
  });

  it("skips Supabase storage cleanup when service is unavailable", async () => {
    mockIsServiceAvailable.mockReturnValue(false);
    const db = createMockDb([{ storagePath: "files/test.pdf" }]);
    await deleteUserAccount(
      db as unknown as Parameters<typeof deleteUserAccount>[0],
      baseParams,
    );
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("cleans up Supabase storage when service is available and files exist", async () => {
    mockIsServiceAvailable.mockReturnValue(true);
    const files = [
      { storagePath: "user-123/file1.pdf" },
      { storagePath: "user-123/file2.docx" },
    ];
    const db = createMockDb(files);
    await deleteUserAccount(
      db as unknown as Parameters<typeof deleteUserAccount>[0],
      baseParams,
    );
    expect(mockRemove).toHaveBeenCalledWith([
      "user-123/file1.pdf",
      "user-123/file2.docx",
    ]);
  });

  it("skips Supabase cleanup when user has no files", async () => {
    mockIsServiceAvailable.mockReturnValue(true);
    const db = createMockDb([]);
    await deleteUserAccount(
      db as unknown as Parameters<typeof deleteUserAccount>[0],
      baseParams,
    );
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("continues deletion even if Supabase storage cleanup fails", async () => {
    mockIsServiceAvailable.mockReturnValue(true);
    mockRemove.mockResolvedValue({ error: { message: "Storage error" } });
    const db = createMockDb([{ storagePath: "files/test.pdf" }]);
    await deleteUserAccount(
      db as unknown as Parameters<typeof deleteUserAccount>[0],
      baseParams,
    );
    expect(db.transaction).toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalled();
  });

  it("sends confirmation email after successful deletion", async () => {
    const db = createMockDb();
    await deleteUserAccount(
      db as unknown as Parameters<typeof deleteUserAccount>[0],
      baseParams,
    );
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
    await deleteUserAccount(
      db as unknown as Parameters<typeof deleteUserAccount>[0],
      baseParams,
    );
    expect(mockLogError).toHaveBeenCalled();
  });

  it("includes deletedBy in logs when provided", async () => {
    const db = createMockDb();
    await deleteUserAccount(
      db as unknown as Parameters<typeof deleteUserAccount>[0],
      {
        ...baseParams,
        deletedBy: "admin-456",
      },
    );
    expect(mockLogInfo).toHaveBeenCalledWith(
      "Starting user deletion",
      expect.objectContaining({ deletedBy: "admin-456" }),
    );
  });

  it("omits deletedBy from logs when not provided", async () => {
    const db = createMockDb();
    await deleteUserAccount(
      db as unknown as Parameters<typeof deleteUserAccount>[0],
      baseParams,
    );
    expect(mockLogInfo).toHaveBeenCalledWith(
      "Starting user deletion",
      expect.not.objectContaining({ deletedBy: expect.anything() }),
    );
  });

  it("propagates database errors", async () => {
    const db = createMockDb();
    db._chains.txDeleteWhere.mockRejectedValue(new Error("DB connection lost"));
    await expect(
      deleteUserAccount(
        db as unknown as Parameters<typeof deleteUserAccount>[0],
        baseParams,
      ),
    ).rejects.toThrow("DB connection lost");
  });
});
