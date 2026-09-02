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

  // The pending/rejected branches throw an APIError carrying ACCOUNT_PENDING /
  // ACCOUNT_REJECTED, but the function's own catch swallows it and returns
  // false. Session creation is still aborted -- the gate holds -- yet Better
  // Auth never sees the reason code, so the client cannot tell "pending" from
  // "rejected" from any other failure. These tests pin the behaviour as it
  // ships; if the reason codes are ever meant to reach the caller, the catch
  // has to rethrow APIError and these expectations change with it.
  it("blocks a pending non-admin (reason code swallowed by the catch)", async () => {
    mockLimit.mockResolvedValue([row({ status: "pending" })]);
    await expect(gateSessionCreation({ userId: "u1" })).resolves.toBe(false);
    expect(mockLogError).toHaveBeenCalled();
  });

  it("blocks a rejected non-admin (reason code swallowed by the catch)", async () => {
    mockLimit.mockResolvedValue([row({ status: "rejected" })]);
    await expect(gateSessionCreation({ userId: "u1" })).resolves.toBe(false);
  });

  it("aborts rather than allowing when the lookup itself throws", async () => {
    mockLimit.mockRejectedValue(new Error("db down"));
    await expect(gateSessionCreation({ userId: "u1" })).resolves.toBe(false);
  });
});
