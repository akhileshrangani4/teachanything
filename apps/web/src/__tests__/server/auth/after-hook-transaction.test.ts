/**
 * @jest-environment node
 */
import { jest, describe, it, expect } from "@jest/globals";
import { betterAuth, APIError } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

/**
 * Pins the Better Auth behavior behind `autoSignIn: false` in `config.ts`.
 *
 * Since 1.7 (upstream PR #7345), `databaseHooks.*.after` is queued until the
 * surrounding transaction finishes, and dropped if it errors. Sign-up runs
 * inside one. With auto sign-in on, our session gate rejects every new
 * (pending) user, the sign-up request errors, and the `user.create.after` hook
 * that emails the admins is silently dropped.
 * That broke admin notifications from 1.34.13 (2026-09-16) until this fix.
 *
 * This drives a real sign-up through Better Auth with the same shape of hooks
 * as `config.ts`. If a Better Auth bump changes the outcome, revisit the config.
 */
function createAuth(autoSignIn: boolean) {
  const db: Record<string, Record<string, unknown>[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
  };
  const notifyAdmins = jest.fn(async () => {});

  const auth = betterAuth({
    database: memoryAdapter(db),
    secret: "test-secret-at-least-32-characters-long",
    baseURL: "http://localhost:3000",
    emailAndPassword: { enabled: true, autoSignIn },
    databaseHooks: {
      user: { create: { after: notifyAdmins } },
      session: {
        create: {
          // Every new user is pending, so the gate always rejects at sign-up.
          before: async () => {
            throw new APIError("UNAUTHORIZED", { message: "ACCOUNT_PENDING" });
          },
        },
      },
    },
  });

  const signUp = () =>
    auth.api.signUpEmail({
      body: {
        name: "New Professor",
        email: "new.professor@example.edu",
        password: "a-long-enough-password",
      },
    });

  return { db, notifyAdmins, signUp };
}

describe("sign-up admin notification", () => {
  it("drops the create.after hook when sign-up tries to sign in a pending user", async () => {
    const { notifyAdmins, signUp } = createAuth(true);

    await expect(signUp()).rejects.toThrow("ACCOUNT_PENDING");

    // The admins never hear about it. (The memory adapter rolls the user back
    // too; our Drizzle adapter runs with `transaction: false`, so in production
    // the user row stayed, which is what made the failure silent.)
    expect(notifyAdmins).not.toHaveBeenCalled();
  });

  it("runs the create.after hook with autoSignIn off", async () => {
    const { db, notifyAdmins, signUp } = createAuth(false);

    const result = await signUp();

    expect(result.token).toBeNull();
    expect(db.user).toHaveLength(1);
    expect(db.session).toHaveLength(0);
    expect(notifyAdmins).toHaveBeenCalledTimes(1);
  });
});
