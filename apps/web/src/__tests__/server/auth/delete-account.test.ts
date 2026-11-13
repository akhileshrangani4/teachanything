/**
 * @jest-environment node
 *
 * deleteOwnAccount maps a storage cleanup failure to a message that tells the
 * user the account is intact and the deletion can be retried.
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { initTRPC, TRPCError } from "@trpc/server";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

class StorageCleanupError extends Error {}
const mockDeleteUserAccount = jest.fn<() => Promise<void>>();

// Stand-in for the real procedure builder, minus the session middleware.
const t = initTRPC
  .context<{ db: unknown; session: unknown; headers: Headers }>()
  .create();

jest.unstable_mockModule("@/server/trpc", () => ({
  protectedProcedure: t.procedure,
}));
jest.unstable_mockModule("@/server/rate-limit", () => ({
  requireRateLimit: async () => ({ success: true, reset: 0 }),
  passwordUpdateRateLimit: {},
}));
jest.unstable_mockModule("@/server/auth", () => ({
  auth: { api: { revokeSessions: async () => undefined } },
}));
jest.unstable_mockModule("bcryptjs", () => ({
  compare: async () => true,
}));
jest.unstable_mockModule("@/server/services/user-deletion", () => ({
  deleteUserAccount: mockDeleteUserAccount,
  StorageCleanupError,
}));
jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

const { deleteOwnAccountProcedure } =
  await import("@/server/routers/auth/procedures/delete-account");

const createCaller = t.createCallerFactory(
  t.router({ deleteOwnAccount: deleteOwnAccountProcedure }),
);

function caller() {
  const limit = async () => [{ password: "hash" }];
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit }) }) }),
  };
  return createCaller({
    db,
    headers: new Headers(),
    session: {
      user: { id: "user-1", email: "u@test.edu", name: "U", role: "user" },
    },
  });
}

async function deletionError(): Promise<TRPCError> {
  const error = await caller()
    .deleteOwnAccount({ password: "pw" })
    .then(
      () => undefined,
      (e: unknown) => e,
    );
  expect(error).toBeInstanceOf(TRPCError);
  return error as TRPCError;
}

describe("deleteOwnAccount", () => {
  beforeEach(() => {
    mockDeleteUserAccount.mockResolvedValue(undefined);
  });

  it("succeeds when the account is deleted", async () => {
    await expect(
      caller().deleteOwnAccount({ password: "pw" }),
    ).resolves.toEqual({ success: true });
  });

  it("tells the user to retry when storage cleanup fails", async () => {
    mockDeleteUserAccount.mockRejectedValue(new StorageCleanupError());
    const error = await deletionError();
    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.message).toBe("Couldn't remove your files — please try again");
  });

  it("keeps the generic message for other failures", async () => {
    mockDeleteUserAccount.mockRejectedValue(new Error("DB connection lost"));
    const error = await deletionError();
    expect(error.message).toBe("Failed to delete account");
  });
});
