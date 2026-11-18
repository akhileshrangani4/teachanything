/**
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { initTRPC } from "@trpc/server";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const t = initTRPC.context<{ db: unknown; session: unknown }>().create();
const mockCookieSet = jest.fn();
const mockCookieDelete = jest.fn();
let isRateLimited = false;

jest.unstable_mockModule("@/server/trpc", () => ({
  protectedProcedure: t.procedure,
}));
jest.unstable_mockModule("@/lib/env", () => ({
  env: { NODE_ENV: "production" },
}));
jest.unstable_mockModule("@/server/rate-limit", () => ({
  localeUpdateRateLimit: null,
  checkRateLimit: async () => ({
    success: !isRateLimited,
    reset: Date.now() + 60_000,
  }),
}));
jest.unstable_mockModule("next/headers", () => ({
  cookies: async () => ({ set: mockCookieSet, delete: mockCookieDelete }),
}));

const { updatePreferredLocaleProcedure } =
  await import("@/server/routers/auth/procedures/locale");

const createCaller = t.createCallerFactory(
  t.router({ save: updatePreferredLocaleProcedure }),
);

function callerWith(returned: unknown[]) {
  const set = jest.fn(() => ({
    where: () => ({ returning: async () => returned }),
  }));
  const db = { update: () => ({ set }) };
  return {
    set,
    caller: createCaller({ db, session: { user: { id: "user-1" } } }),
  };
}

describe("updatePreferredLocale", () => {
  beforeEach(() => {
    mockCookieSet.mockClear();
    mockCookieDelete.mockClear();
    isRateLimited = false;
  });

  it("refuses to save when the user is rate limited", async () => {
    isRateLimited = true;
    const { caller, set } = callerWith([{ preferredLocale: "fr" }]);

    await expect(caller.save({ locale: "fr" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });

    expect(set).not.toHaveBeenCalled();
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("saves the language and sets the browser cookie", async () => {
    const { caller, set } = callerWith([{ preferredLocale: "fr" }]);

    await expect(caller.save({ locale: "fr" })).resolves.toEqual({
      locale: "fr",
    });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ preferredLocale: "fr" }),
    );
    expect(mockCookieSet).toHaveBeenCalledWith(
      "NEXT_LOCALE",
      "fr",
      expect.objectContaining({
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        secure: true,
      }),
    );
  });

  it("clears the saved language and the browser cookie", async () => {
    const { caller, set } = callerWith([{ preferredLocale: null }]);

    await expect(caller.save({ locale: null })).resolves.toEqual({
      locale: null,
    });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ preferredLocale: null }),
    );
    expect(mockCookieDelete).toHaveBeenCalledWith("NEXT_LOCALE");
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("does not treat a missing language as clearing it", async () => {
    const { caller, set } = callerWith([{ preferredLocale: null }]);

    await expect(caller.save({} as { locale: "fr" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    expect(set).not.toHaveBeenCalled();
    expect(mockCookieDelete).not.toHaveBeenCalled();
  });

  it("rejects a language that is not offered, without saving", async () => {
    const { caller, set } = callerWith([]);

    await expect(caller.save({ locale: "xx" as "fr" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    expect(set).not.toHaveBeenCalled();
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("fails without a cookie when the user no longer exists", async () => {
    const { caller } = callerWith([]);

    await expect(caller.save({ locale: "de" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(mockCookieSet).not.toHaveBeenCalled();
  });
});
