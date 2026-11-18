/**
 * @jest-environment node
 */
import { jest, describe, it, expect } from "@jest/globals";
import { initTRPC } from "@trpc/server";
import type { AppErrorCause } from "@/server/app-error";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const t = initTRPC.context<{ db: unknown; session: unknown }>().create();
// The limiter window has already reset by the time the error is built.
const denied = async () => ({ success: false, reset: Date.now() - 1_000 });

jest.unstable_mockModule("@/server/trpc", () => ({
  protectedProcedure: t.procedure,
}));
jest.unstable_mockModule("@/server/rate-limit", () => ({
  checkRateLimit: denied,
  requireRateLimit: denied,
  passwordUpdateRateLimit: null,
  fileUploadRateLimit: null,
}));
jest.unstable_mockModule("@/server/auth", () => ({ auth: {} }));
jest.unstable_mockModule("@/server/supabase", () => ({
  createSupabaseClient: jest.fn(),
}));
jest.unstable_mockModule("@/server/services/user-deletion", () => ({
  deleteUserAccount: jest.fn(),
  StorageCleanupError: class StorageCleanupError extends Error {},
}));

const { updatePasswordProcedure } =
  await import("@/server/routers/auth/procedures/password");
const { deleteOwnAccountProcedure } =
  await import("@/server/routers/auth/procedures/delete-account");
const { createUploadUrlProcedure } =
  await import("@/server/routers/files/procedures/create-upload-url");

const caller = t.createCallerFactory(
  t.router({
    updatePassword: updatePasswordProcedure,
    deleteAccount: deleteOwnAccountProcedure,
    createUpload: createUploadUrlProcedure,
  }),
)({ db: {}, session: { user: { id: "user-1" } } });

async function waitShown(call: Promise<unknown>) {
  const error = (await call.catch((e: unknown) => e)) as {
    cause?: AppErrorCause;
  };
  return error.cause?.values?.minutes;
}

describe("rate limit errors", () => {
  it.each([
    [
      "updatePassword",
      () => caller.updatePassword({ currentPassword: "a", newPassword: "b" }),
    ],
    ["deleteAccount", () => caller.deleteAccount({ password: "a" })],
    [
      "createUpload",
      () =>
        caller.createUpload({
          fileName: "a.pdf",
          fileType: "application/pdf",
          fileSize: 1,
        }),
    ],
  ])("%s never tells the user to wait 0 minutes", async (_name, call) => {
    await expect(waitShown(call())).resolves.toBe(1);
  });
});
