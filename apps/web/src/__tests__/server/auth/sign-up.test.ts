/**
 * @jest-environment node
 */
import { jest, describe, it, expect } from "@jest/globals";
import { betterAuth, APIError } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

import { rejectDuplicateSignUp } from "@/server/auth/sign-up-guard";

/**
 * Pins the Better Auth behavior behind the sign-up settings in `config.ts`.
 *
 * Since 1.7 (upstream PR #7345), `databaseHooks.*.after` is queued until the
 * surrounding transaction finishes, and dropped if it errors. Sign-up runs
 * inside one. With auto sign-in on, our session gate rejects every new
 * (pending) user, the sign-up request errors, and the `user.create.after` hook
 * that emails the admins is silently dropped. That broke admin notifications
 * from 1.34.13 (2026-09-16) until `autoSignIn: false`.
 *
 * Auto sign-in off makes Better Auth answer duplicate sign-ups with a fake
 * 200, so `rejectDuplicateSignUp` restores the "already exists" error.
 *
 * This drives real sign-ups through Better Auth with the same shape of hooks
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
    logger: { disabled: true },
    emailAndPassword: { enabled: true, autoSignIn },
    hooks: { before: rejectDuplicateSignUp },
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

  const signUp = (email = "new.professor@example.edu") =>
    auth.api.signUpEmail({
      body: {
        name: "New Professor",
        email,
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

describe("rejectDuplicateSignUp", () => {
  it.each(["new.professor@example.edu", "New.Professor@Example.EDU"])(
    "rejects a second sign-up for %s with USER_ALREADY_EXISTS",
    async (duplicateEmail) => {
      const { db, notifyAdmins, signUp } = createAuth(false);
      await signUp();

      await expect(signUp(duplicateEmail)).rejects.toMatchObject({
        statusCode: 422,
        body: {
          code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
          message: "User already exists. Use another email.",
        },
      });

      // No second account and no second admin email.
      expect(db.user).toHaveLength(1);
      expect(notifyAdmins).toHaveBeenCalledTimes(1);
    },
  );

  it("lets a different email through", async () => {
    const { db, notifyAdmins, signUp } = createAuth(false);
    await signUp();

    await signUp("another.professor@example.edu");

    expect(db.user).toHaveLength(2);
    expect(notifyAdmins).toHaveBeenCalledTimes(2);
  });
});
