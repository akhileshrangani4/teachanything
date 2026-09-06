/**
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

type UserRow = { id: string; email: string; role: string; status: string };

const mockLimit = jest.fn<() => Promise<UserRow[]>>();
const mockLogInfo = jest.fn();
const mockLogError = jest.fn();

jest.unstable_mockModule("@teachanything/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: mockLimit }) }),
    }),
  },
}));

jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: mockLogInfo,
  logError: mockLogError,
}));

const { gateSessionCreation } = await import("@/server/auth/session-gate");

const row = (over: Partial<UserRow> = {}): UserRow => ({
  id: "u1",
  email: "student@gwu.edu",
  role: "user",
  status: "approved",
  ...over,
});

describe("gateSessionCreation", () => {
  beforeEach(() => {
    mockLimit.mockReset();
    mockLogInfo.mockReset();
    mockLogError.mockReset();
  });

  it("aborts when the user row does not exist", async () => {
    mockLimit.mockResolvedValue([]);
    await expect(gateSessionCreation({ userId: "missing" })).resolves.toBe(
      false,
    );
    expect(mockLogError).toHaveBeenCalled();
  });

  it("lets an admin through regardless of approval status", async () => {
    mockLimit.mockResolvedValue([row({ role: "admin", status: "pending" })]);
    await expect(gateSessionCreation({ userId: "u1" })).resolves.toBe(true);
  });

  it("allows an approved non-admin", async () => {
    mockLimit.mockResolvedValue([row({ status: "approved" })]);
    await expect(gateSessionCreation({ userId: "u1" })).resolves.toBe(true);
  });

  // The pending/rejected branches raise APIError carrying ACCOUNT_PENDING /
  // ACCOUNT_REJECTED so the login page can tell a user awaiting approval apart
  // from one who was turned down. The catch used to swallow both into a bare
  // `false`; it now rethrows APIError and keeps the swallow for real failures.
  it("surfaces ACCOUNT_PENDING for a pending non-admin", async () => {
    mockLimit.mockResolvedValue([row({ status: "pending" })]);
    await expect(gateSessionCreation({ userId: "u1" })).rejects.toThrow(
      "ACCOUNT_PENDING",
    );
  });

  it("surfaces ACCOUNT_REJECTED for a rejected non-admin", async () => {
    mockLimit.mockResolvedValue([row({ status: "rejected" })]);
    await expect(gateSessionCreation({ userId: "u1" })).rejects.toThrow(
      "ACCOUNT_REJECTED",
    );
  });

  it("does not log a rejection as an error", async () => {
    mockLimit.mockResolvedValue([row({ status: "pending" })]);
    await expect(gateSessionCreation({ userId: "u1" })).rejects.toThrow();
    expect(mockLogError).not.toHaveBeenCalled();
  });

  // A database outage must still abort rather than propagate: aborting the
  // session is the safe default, and it is not the user's fault to report.
  it("aborts rather than allowing when the lookup itself throws", async () => {
    mockLimit.mockRejectedValue(new Error("db down"));
    await expect(gateSessionCreation({ userId: "u1" })).resolves.toBe(false);
    expect(mockLogError).toHaveBeenCalled();
  });
});
