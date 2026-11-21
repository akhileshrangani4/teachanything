/**
 * @jest-environment node
 */
import { jest, describe, it, expect } from "@jest/globals";
import { initTRPC } from "@trpc/server";

// The schema module pulls in the db client, which reads these at import time.
process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const t = initTRPC.context<{ db: unknown }>().create();
jest.unstable_mockModule("@/server/trpc", () => ({
  adminProcedure: t.procedure,
}));
// users.ts imports the auth helpers for approve/reject, which aren't under test.
jest.unstable_mockModule("@/server/auth", () => ({
  approveUser: async () => {},
  rejectUser: async () => {},
}));

const usage = await import("@/server/queries/message-usage");
const { getChatbotProcedure, getUserProcedure } =
  await import("@/server/routers/admin/procedures/details");
const { getAllUsersProcedure } =
  await import("@/server/routers/admin/procedures/users");
const { getAllChatbotsProcedure } =
  await import("@/server/routers/admin/procedures/chatbots");
const { getUserChatbotsProcedure } =
  await import("@/server/routers/admin/procedures/daily-limits");

/**
 * A db whose every `select(...)` chain (joins, where, groupBy, orderBy, ...)
 * resolves to the next entry of `results`, in call order. Records how many
 * queries ran.
 */
function fakeDb(results: unknown[][]) {
  let next = 0;
  const chain = (rows: unknown[]): unknown =>
    new Proxy(() => {}, {
      get: (_target, prop) =>
        prop === "then"
          ? (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
              Promise.resolve(rows).then(resolve, reject)
          : () => chain(rows),
    });
  const db = {
    select: () => chain(results[next++] ?? []),
    get queryCount() {
      return next;
    },
  };
  return db;
}

const caller = (db: unknown) =>
  t.createCallerFactory(
    t.router({
      getChatbot: getChatbotProcedure,
      getUser: getUserProcedure,
      getAllUsers: getAllUsersProcedure,
      getAllChatbots: getAllChatbotsProcedure,
      getUserChatbots: getUserChatbotsProcedure,
    }),
  )({ db });

const usageRow = (id: string, today: number) => ({
  id,
  today,
  last7Days: today + 10,
  last30Days: today + 100,
});

describe("message usage helpers", () => {
  it("skip the database when there is nothing to count", async () => {
    const db = fakeDb([]);
    await expect(usage.getChatbotUsage(db as never, [])).resolves.toEqual(
      new Map(),
    );
    await expect(usage.getOwnerUsage(db as never, [])).resolves.toEqual(
      new Map(),
    );
    expect(db.queryCount).toBe(0);
  });

  it("key each row's counts by its id", async () => {
    const db = fakeDb([[usageRow("bot-1", 5)], [usageRow("owner-1", 9)]]);
    const chatbots = await usage.getChatbotUsage(db as never, ["bot-1"]);
    const owners = await usage.getOwnerUsage(db as never, ["owner-1"]);
    expect(chatbots.get("bot-1")).toEqual({
      today: 5,
      last7Days: 15,
      last30Days: 105,
    });
    expect(owners.get("owner-1")?.today).toBe(9);
  });

  it("build sortable today-count expressions", () => {
    expect(usage.chatbotTodayCountSql(usage.NO_USAGE as never)).toBeDefined();
    expect(usage.ownerTodayCountSql(usage.NO_USAGE as never)).toBeDefined();
  });
});

const chatbotRow = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Biology",
  userId: "owner-1",
};

describe("admin.getChatbot", () => {
  it("returns the chatbot with its own and its owner's usage", async () => {
    const db = fakeDb([
      [chatbotRow],
      [usageRow(chatbotRow.id, 87)],
      [usageRow("owner-1", 99)],
    ]);
    const chatbot = await caller(db).getChatbot({ chatbotId: chatbotRow.id });
    expect(chatbot).toMatchObject({
      name: "Biology",
      usage: { today: 87 },
      ownerUsage: { today: 99 },
    });
  });

  it("falls back to zero usage for a chatbot nobody has used", async () => {
    const db = fakeDb([[chatbotRow], [], []]);
    const chatbot = await caller(db).getChatbot({ chatbotId: chatbotRow.id });
    expect(chatbot.usage).toEqual(usage.NO_USAGE);
    expect(chatbot.ownerUsage).toEqual(usage.NO_USAGE);
  });

  it("reports an unknown chatbot as NOT_FOUND", async () => {
    await expect(
      caller(fakeDb([[]])).getChatbot({ chatbotId: chatbotRow.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("admin.getUser", () => {
  it("returns the user with their usage across all chatbots", async () => {
    const db = fakeDb([
      [{ id: "owner-1", name: "Dr. A" }],
      [usageRow("owner-1", 42)],
    ]);
    await expect(
      caller(db).getUser({ userId: "owner-1" }),
    ).resolves.toMatchObject({ name: "Dr. A", usage: { today: 42 } });
  });

  it("reports an unknown user as NOT_FOUND", async () => {
    await expect(
      caller(fakeDb([[]])).getUser({ userId: "missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("admin lists sorted by today's usage", () => {
  it("getAllUsers attaches usage, with zero for users without any", async () => {
    const db = fakeDb([
      [{ count: 2 }],
      [{ id: "owner-1" }, { id: "owner-2" }],
      [usageRow("owner-1", 300)],
    ]);
    const result = await caller(db).getAllUsers({
      sortBy: "usageToday",
      search: "dr",
    });
    expect(result.totalCount).toBe(2);
    expect(result.users.map((u) => u.usage.today)).toEqual([300, 0]);
  });

  it("getAllChatbots attaches chatbot and owner usage", async () => {
    const db = fakeDb([
      [{ count: 1 }],
      [{ count: 0 }],
      [chatbotRow],
      [usageRow(chatbotRow.id, 150)],
      [usageRow("owner-1", 300)],
    ]);
    const result = await caller(db).getAllChatbots({ sortBy: "usageToday" });
    expect(result.chatbots[0]).toMatchObject({
      usage: { today: 150 },
      ownerUsage: { today: 300 },
    });
  });
});

describe("admin.getUserChatbots", () => {
  it("lists a professor's chatbots with each one's usage", async () => {
    const db = fakeDb([
      [
        { id: "bot-1", name: "Biology" },
        { id: "bot-2", name: "Chemistry" },
      ],
      [usageRow("bot-1", 12)],
    ]);
    const chatbots = await caller(db).getUserChatbots({ userId: "owner-1" });
    expect(chatbots.map((c) => [c.name, c.usage.today])).toEqual([
      ["Biology", 12],
      ["Chemistry", 0],
    ]);
  });
});
