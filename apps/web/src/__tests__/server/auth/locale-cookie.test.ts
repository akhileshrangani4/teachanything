/**
 * @jest-environment node
 */
import { jest, describe, it, expect } from "@jest/globals";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

jest.unstable_mockModule("@/lib/env", () => ({
  env: { NODE_ENV: "test" },
}));

const { syncLocaleCookie } = await import("@/server/auth/locale-cookie");

const BASE_URL = "http://localhost:3000";
const CREDENTIALS = { email: "a@example.edu", password: "correct-horse-1" };

/** Real Better Auth with a saved language on the user, so the hook sees the real session. */
async function createAuth(preferredLocale: string | null) {
  const db: Record<string, Record<string, unknown>[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
  };
  const auth = betterAuth({
    database: memoryAdapter(db),
    secret: "test-secret-at-least-32-characters-long",
    baseURL: BASE_URL,
    logger: { disabled: true },
    emailAndPassword: { enabled: true, autoSignIn: false },
    user: {
      additionalFields: {
        preferredLocale: { type: "string", required: false, input: false },
      },
    },
    hooks: { after: syncLocaleCookie },
  });
  await auth.api.signUpEmail({ body: { name: "A", ...CREDENTIALS } });
  db.user![0]!.preferredLocale = preferredLocale;
  return auth;
}

async function signIn(
  auth: Awaited<ReturnType<typeof createAuth>>,
  password = CREDENTIALS.password,
) {
  const res = await auth.handler(
    new Request(`${BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: BASE_URL },
      body: JSON.stringify({ email: CREDENTIALS.email, password }),
    }),
  );
  return res.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith("NEXT_LOCALE="));
}

describe("the language cookie at sign-in", () => {
  it("takes the user's saved language", async () => {
    const cookie = await signIn(await createAuth("fr"));

    expect(cookie).toMatch(/^NEXT_LOCALE=fr;/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Max-Age=31536000/i);
  });

  it.each([
    ["no saved language", null],
    ["a language no longer offered", "xx"],
  ])("is cleared for a user with %s", async (_name, saved) => {
    const cookie = await signIn(await createAuth(saved));

    expect(cookie).toMatch(/^NEXT_LOCALE=;/);
    expect(cookie).toMatch(/Max-Age=0/i);
  });

  it("is left alone when sign-in fails", async () => {
    const cookie = await signIn(await createAuth("fr"), "wrong-password-1");

    expect(cookie).toBeUndefined();
  });
});
