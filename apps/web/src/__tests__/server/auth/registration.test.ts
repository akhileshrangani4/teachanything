/**
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const mockUpdateWhere = jest.fn<() => Promise<void>>();
const mockDeleteWhere = jest.fn<() => Promise<void>>();
const mockSendAdminNotificationEmail = jest.fn<() => Promise<void>>();
const mockLogError = jest.fn();

jest.unstable_mockModule("@teachanything/db", () => ({
  db: {
    update: () => ({ set: () => ({ where: mockUpdateWhere }) }),
    delete: () => ({ where: mockDeleteWhere }),
  },
}));

jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: mockLogError,
}));

jest.unstable_mockModule("@/server/email", () => ({
  sendAdminNotificationEmail: mockSendAdminNotificationEmail,
}));

const { registerPendingUserAndNotify } =
  await import("@/server/auth/registration");

const USER = { id: "u1", email: "student@gwu.edu", name: "Student" };

describe("registerPendingUserAndNotify", () => {
  beforeEach(() => {
    mockUpdateWhere.mockReset().mockResolvedValue(undefined);
    mockDeleteWhere.mockReset().mockResolvedValue(undefined);
    mockSendAdminNotificationEmail.mockReset().mockResolvedValue(undefined);
    mockLogError.mockReset();
  });

  it("marks the user pending, notifies admins, and keeps the row", async () => {
    await expect(registerPendingUserAndNotify(USER)).resolves.toBeUndefined();
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
    expect(mockSendAdminNotificationEmail).toHaveBeenCalledWith({
      userId: "u1",
      email: "student@gwu.edu",
      name: "Student",
    });
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });

  it('falls back to "Unknown" when the user has no name', async () => {
    await registerPendingUserAndNotify({ ...USER, name: null });
    expect(mockSendAdminNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Unknown" }),
    );
  });

  // The compensating transaction: an account nobody was told about must not
  // linger in the pending list, so a failed notification rolls the user back.
  it("deletes the user and fails registration when the admin email fails", async () => {
    mockSendAdminNotificationEmail.mockRejectedValue(new Error("smtp down"));
    await expect(registerPendingUserAndNotify(USER)).rejects.toThrow(
      /Unable to complete registration/,
    );
    expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
  });

  it("still fails registration when the rollback delete also fails", async () => {
    mockSendAdminNotificationEmail.mockRejectedValue(new Error("smtp down"));
    mockDeleteWhere.mockRejectedValue(new Error("db down"));
    // The delete error is logged, never surfaced: the caller must see the
    // registration failure, not the cleanup failure.
    await expect(registerPendingUserAndNotify(USER)).rejects.toThrow(
      /Unable to complete registration/,
    );
    expect(mockLogError).toHaveBeenCalledTimes(2);
  });

  it("rolls back when the status update itself fails", async () => {
    mockUpdateWhere.mockRejectedValue(new Error("db down"));
    await expect(registerPendingUserAndNotify(USER)).rejects.toThrow(
      /Unable to complete registration/,
    );
    expect(mockSendAdminNotificationEmail).not.toHaveBeenCalled();
    expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
  });
});
