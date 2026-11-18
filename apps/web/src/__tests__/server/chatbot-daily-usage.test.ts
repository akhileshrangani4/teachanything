/**
 * @jest-environment node
 */
import { jest, describe, it, expect } from "@jest/globals";
import { initTRPC } from "@trpc/server";

// The schema module pulls in the db client, which reads these at import time.
process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const t = initTRPC
  .context<{ db: unknown; session: { user: { id: string } } }>()
  .create();
jest.unstable_mockModule("@/server/trpc", () => ({
  protectedProcedure: t.procedure,
}));

let todayByChatbot: Record<string, number> = {};
let ownerToday = 0;
jest.unstable_mockModule("@/server/queries/message-usage", () => ({
  getChatbotUsage: async (_db: unknown, ids: string[]) =>
    new Map(
      ids
        .filter((id) => id in todayByChatbot)
        .map((id) => [
          id,
          { today: todayByChatbot[id], last7Days: 0, last30Days: 0 },
        ]),
    ),
  getOwnerUsage: async () =>
    new Map([["owner-1", { today: ownerToday, last7Days: 0, last30Days: 0 }]]),
}));

const schema = await import("@teachanything/db/schema");
const { getDailyUsageProcedure } =
  await import("@/server/routers/chatbot/daily-usage");

/** A db whose user lookup and chatbot list return the given rows. */
function fakeDb(owner: unknown, chatbots: unknown[]) {
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          const rows = table === schema.user ? [owner] : chatbots;
          return Object.assign(Promise.resolve(rows), {
            limit: async () => rows,
          });
        },
      }),
    }),
  };
}

function call(db: unknown) {
  const caller = t.createCallerFactory(
    t.router({ getDailyUsage: getDailyUsageProcedure }),
  )({ db, session: { user: { id: "owner-1" } } });
  return caller.getDailyUsage();
}

describe("chatbot.getDailyUsage", () => {
  it("reports today's usage against the default limits", async () => {
    ownerToday = 99;
    todayByChatbot = { "bot-1": 87 };
    const db = fakeDb({ dailyMessageLimit: null, chatbotsPaused: false }, [
      { id: "bot-1", dailyMessageLimit: null, paused: false },
      { id: "bot-2", dailyMessageLimit: null, paused: true },
    ]);

    await expect(call(db)).resolves.toEqual({
      total: { today: 99, limit: 300, paused: false },
      byChatbot: {
        "bot-1": { today: 87, limit: 150, paused: false },
        "bot-2": { today: 0, limit: 150, paused: true },
      },
    });
  });

  it("uses admin overrides and reports a paused owner", async () => {
    ownerToday = 0;
    todayByChatbot = {};
    const db = fakeDb({ dailyMessageLimit: 900, chatbotsPaused: true }, [
      { id: "bot-1", dailyMessageLimit: 450, paused: false },
    ]);

    await expect(call(db)).resolves.toEqual({
      total: { today: 0, limit: 900, paused: true },
      byChatbot: { "bot-1": { today: 0, limit: 450, paused: false } },
    });
  });
});
