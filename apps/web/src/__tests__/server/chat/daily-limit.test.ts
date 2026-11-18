/**
 * @jest-environment node
 */
import { jest, describe, it, expect } from "@jest/globals";
import { initTRPC } from "@trpc/server";

// The schema module pulls in the db client, which reads these at import time.
process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

let isWithinLimits = true;
/** Arguments of each counter call. A plain function, not a jest.fn: the jest
 * config resets mock implementations between tests. */
const counterCalls: unknown[][] = [];
jest.unstable_mockModule("@/server/rate-limit", () => ({
  consumeDailyMessage: async (...args: unknown[]) => {
    counterCalls.push(args);
    return isWithinLimits;
  },
}));

const t = initTRPC.context<{ db: unknown }>().create();
jest.unstable_mockModule("@/server/trpc", () => ({
  adminProcedure: t.procedure,
}));

const { resolveDailyLimits, enforceDailyLimit } =
  await import("@/server/chat/daily-limit");
const { setChatbotDailyLimitProcedure, setUserDailyLimitProcedure } =
  await import("@/server/routers/admin/procedures/daily-limits");
const { ChatRequestError } = await import("@/server/chat/request");

/** A db whose `select ... limit` resolves to `rows`. */
function dbReturning(rows: unknown[]) {
  return {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => rows }) }),
    }),
  } as never;
}

/** A db whose `update ... returning` resolves to `rows`, recording `set`. */
function dbUpdating(rows: unknown[]) {
  const sets: unknown[] = [];
  const db = {
    update: () => ({
      set: (values: unknown) => {
        sets.push(values);
        return { where: () => ({ returning: async () => rows }) };
      },
    }),
  };
  return { db, sets };
}

const chatbot = { id: "bot-1", userId: "owner-1", dailyMessageLimit: null };

describe("resolveDailyLimits", () => {
  it("uses the defaults when no override is set", async () => {
    const db = dbReturning([{ dailyMessageLimit: null }]);
    await expect(resolveDailyLimits(db, chatbot)).resolves.toEqual({
      chatbot: 150,
      owner: 300,
    });
  });

  it("uses the chatbot's and the owner's overrides", async () => {
    const db = dbReturning([{ dailyMessageLimit: 900 }]);
    await expect(
      resolveDailyLimits(db, { ...chatbot, dailyMessageLimit: 450 }),
    ).resolves.toEqual({ chatbot: 450, owner: 900 });
  });
});

describe("enforceDailyLimit", () => {
  it("passes the resolved limits to the counter", async () => {
    isWithinLimits = true;
    const db = dbReturning([{ dailyMessageLimit: 900 }]);
    await enforceDailyLimit(db, chatbot);
    expect(counterCalls.at(-1)).toEqual([
      { id: "bot-1", ownerId: "owner-1" },
      { chatbot: 150, owner: 900 },
    ]);
  });

  it.each([
    ["the chatbot", { ...chatbot, dailyMessageLimit: 0 }, null],
    ["the owner", chatbot, 0],
  ])(
    "throws chatbot_paused (403) when %s is paused",
    async (_name, bot, ownerLimit) => {
      const callsBefore = counterCalls.length;
      const error = await enforceDailyLimit(
        dbReturning([{ dailyMessageLimit: ownerLimit }]),
        bot,
      ).catch((e: unknown) => e);
      expect(error).toMatchObject({ code: "chatbot_paused", status: 403 });
      // A paused chatbot never touches the counters.
      expect(counterCalls.length).toBe(callsBefore);
    },
  );

  it("throws daily_limit_reached (429) past the limit", async () => {
    isWithinLimits = false;
    const error = await enforceDailyLimit(
      dbReturning([{ dailyMessageLimit: null }]),
      chatbot,
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ChatRequestError);
    expect(error).toMatchObject({ code: "daily_limit_reached", status: 429 });
  });
});

describe("admin daily limit procedures", () => {
  const router = t.router({
    setChatbot: setChatbotDailyLimitProcedure,
    setUser: setUserDailyLimitProcedure,
  });
  const chatbotId = "00000000-0000-4000-8000-000000000001";

  it("saves an override and clears it with null", async () => {
    const { db, sets } = dbUpdating([{ id: chatbotId }]);
    const caller = t.createCallerFactory(router)({ db });
    await caller.setChatbot({ chatbotId, limit: 500 });
    await caller.setUser({ userId: "owner-1", limit: null });
    expect(sets).toMatchObject([
      { dailyMessageLimit: 500 },
      { dailyMessageLimit: null },
    ]);
  });

  it("accepts 0, which pauses", async () => {
    const { db, sets } = dbUpdating([{ id: chatbotId }]);
    const caller = t.createCallerFactory(router)({ db });
    await caller.setChatbot({ chatbotId, limit: 0 });
    expect(sets).toMatchObject([{ dailyMessageLimit: 0 }]);
  });

  it.each([-1, 1.5, 10_001])("rejects a limit of %p", async (limit) => {
    const { db } = dbUpdating([{ id: chatbotId }]);
    const caller = t.createCallerFactory(router)({ db });
    await expect(caller.setChatbot({ chatbotId, limit })).rejects.toThrow();
  });

  it("reports a missing chatbot or user as NOT_FOUND", async () => {
    const { db } = dbUpdating([]);
    const caller = t.createCallerFactory(router)({ db });
    await expect(
      caller.setChatbot({ chatbotId, limit: 500 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      caller.setUser({ userId: "missing", limit: 500 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
