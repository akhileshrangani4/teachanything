/**
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

/**
 * The login page learns that an account is pending or rejected only from the
 * session gate (#480). That is safe only if Better Auth verifies the password
 * before it tries to create a session. This drives real sign-ins through
 * Better Auth with our real gate, so a Better Auth bump that reorders those
 * steps fails here instead of reopening the account-enumeration hole.
 */

type GateRow = { id: string; email: string; role: string; status: string };

// The gate's own lookup, keyed by user id so it reads what sign-up created.
const gateRows = new Map<string, GateRow>();
const gateLookups: string[] = [];

jest.unstable_mockModule("@teachanything/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (condition: { queryChunks: unknown[] }) => ({
          limit: async () => {
            const userId = condition.queryChunks
              .map((chunk) =>
                chunk && typeof chunk === "object" && "value" in chunk
                  ? (chunk as { value: unknown }).value
                  : undefined,
              )
              .find((value): value is string => typeof value === "string");
            if (userId === undefined) throw new Error("no user id in where");
            gateLookups.push(userId);
            const row = gateRows.get(userId);
            return row ? [row] : [];
          },
        }),
      }),
    }),
  },
}));

jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: () => {},
  logError: () => {},
}));

const { gateSessionCreation } = await import("@/server/auth/session-gate");

const PASSWORD = "the-right-password";

function createAuth() {
  const store: Record<string, Record<string, unknown>[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
  };

  const auth = betterAuth({
    database: memoryAdapter(store),
    secret: "test-secret-at-least-32-characters-long",
    baseURL: "http://localhost:3000",
    logger: { disabled: true },
    // Same settings as config.ts that matter here: no auto sign-in, and the
    // session gate on session creation.
    emailAndPassword: { enabled: true, autoSignIn: false },
    databaseHooks: {
      session: {
        create: { before: (session) => gateSessionCreation(session) },
      },
    },
  });

  async function register(email: string, status: string) {
    await auth.api.signUpEmail({
      body: { name: "Professor", email, password: PASSWORD },
    });
    const user = store.user.find((row) => row.email === email);
    if (!user) throw new Error(`sign-up did not create ${email}`);
    const id = String(user.id);
    gateRows.set(id, { id, email, role: "user", status });
  }

  async function signIn(email: string, password: string) {
    const response = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });
    return {
      status: response.status,
      body: (await response.json()) as Record<string, unknown>,
    };
  }

  return { store, register, signIn };
}

describe("sign-in and the approval gate", () => {
  beforeEach(() => {
    gateRows.clear();
    gateLookups.length = 0;
  });

  it("tells a pending user with the right password that the account is pending", async () => {
    const { store, register, signIn } = createAuth();
    await register("pending@example.edu", "pending");

    const result = await signIn("pending@example.edu", PASSWORD);

    expect(result.status).toBe(401);
    expect(result.body.message).toBe("ACCOUNT_PENDING");
    expect(store.session).toHaveLength(0);
    expect(gateLookups).toHaveLength(1);
  });

  it("tells a rejected user with the right password that the account was rejected", async () => {
    const { register, signIn } = createAuth();
    await register("rejected@example.edu", "rejected");

    const result = await signIn("rejected@example.edu", PASSWORD);

    expect(result.status).toBe(401);
    expect(result.body.message).toBe("ACCOUNT_REJECTED");
  });

  it("answers a wrong password for a pending account exactly like an unknown email", async () => {
    const { register, signIn } = createAuth();
    await register("pending@example.edu", "pending");

    const wrongPassword = await signIn(
      "pending@example.edu",
      "not-the-password",
    );
    const unknownEmail = await signIn("nobody@example.edu", "not-the-password");

    expect(wrongPassword).toEqual(unknownEmail);
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.code).toBe("INVALID_EMAIL_OR_PASSWORD");
    // Better Auth rejected the password before session creation, so the gate
    // never looked the account up.
    expect(gateLookups).toHaveLength(0);
  });

  it("answers a wrong password for a rejected account exactly like an unknown email", async () => {
    const { register, signIn } = createAuth();
    await register("rejected@example.edu", "rejected");

    const wrongPassword = await signIn(
      "rejected@example.edu",
      "not-the-password",
    );
    const unknownEmail = await signIn("nobody@example.edu", "not-the-password");

    expect(wrongPassword).toEqual(unknownEmail);
    expect(gateLookups).toHaveLength(0);
  });

  it("signs an approved user in", async () => {
    const { store, register, signIn } = createAuth();
    await register("approved@example.edu", "approved");

    const result = await signIn("approved@example.edu", PASSWORD);

    expect(result.status).toBe(200);
    expect(store.session).toHaveLength(1);
  });
});
