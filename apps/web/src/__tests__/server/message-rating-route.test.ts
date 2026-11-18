/**
 * @jest-environment node
 *
 * POST /api/message-rating/shared: a student rating an assistant message from
 * a public shared link. The database is an in-memory fake that evaluates the
 * route's real drizzle conditions (`eq`/`and` are mocked to plain data), so
 * the ownership check and the upsert's conflict target are what's under test,
 * not a canned lookup result. Rate limiting is mocked at the limiter.
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

// ---- Column references: "<table>.<field>" strings, so the fake can resolve
// conditions against rows and map conflict targets back to insert values. ----
const chatbots = {
  id: "chatbots.id",
  shareToken: "chatbots.shareToken",
  sharingEnabled: "chatbots.sharingEnabled",
};
const conversations = {
  id: "conversations.id",
  chatbotId: "conversations.chatbotId",
  sessionId: "conversations.sessionId",
};
const messages = {
  id: "messages.id",
  conversationId: "messages.conversationId",
  role: "messages.role",
};
const messageRatings = {
  messageId: "messageRatings.messageId",
  sessionId: "messageRatings.sessionId",
};

type Row = Record<string, unknown>;
type Condition =
  | { op: "eq"; column: string; value: unknown }
  | { op: "and"; conditions: Condition[] };

/** Prefix each field with its table, e.g. { id } -> { "chatbots.id" }. */
function qualify(table: string, row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [`${table}.${k}`, v]),
  );
}

function matches(row: Row, cond: Condition): boolean {
  if (cond.op === "and") return cond.conditions.every((c) => matches(row, c));
  // A column on the right-hand side (a join condition) compares two columns.
  const right =
    typeof cond.value === "string" && cond.value in row
      ? row[cond.value]
      : cond.value;
  return row[cond.column] === right;
}

const tables = {
  chatbots: [] as Row[],
  conversations: [] as Row[],
  messages: [] as Row[],
  messageRatings: [] as Row[],
};

const mockLimit = jest.fn<() => Promise<{ success: boolean }>>();

/** Apply a select projection, e.g. { id: "chatbots.id" } -> { id: <value> }. */
function project(fields: Record<string, string>, row: Row): Row {
  return Object.fromEntries(
    Object.entries(fields).map(([key, column]) => [key, row[column]]),
  );
}

const fakeDb = {
  select: (fields: Record<string, string>) => ({
    from: (table: unknown) => {
      const run = (rows: Row[]) => ({
        where: (cond: Condition) => ({
          limit: async (n: number) =>
            rows
              .filter((r) => matches(r, cond))
              .slice(0, n)
              .map((r) => project(fields, r)),
        }),
      });
      if (table === chatbots) {
        return run(tables.chatbots.map((r) => qualify("chatbots", r)));
      }
      return {
        innerJoin: (_joined: unknown, on: Condition) =>
          run(
            tables.messages.flatMap((m) =>
              tables.conversations
                .map((c) => ({
                  ...qualify("messages", m),
                  ...qualify("conversations", c),
                }))
                .filter((r) => matches(r, on)),
            ),
          ),
      };
    },
  }),
  insert: (table: unknown) => ({
    values: (values: Row) => ({
      onConflictDoUpdate: async (opts: { target: string[]; set: Row }) => {
        if (table !== messageRatings) throw new Error("unexpected insert");
        const fields = opts.target.map((col) => col.split(".")[1]!);
        const existing = tables.messageRatings.find((r) =>
          fields.every((f) => r[f] === values[f]),
        );
        if (existing) Object.assign(existing, opts.set);
        else tables.messageRatings.push({ ...values });
      },
    }),
  }),
};

jest.unstable_mockModule("@teachanything/db", () => ({ db: fakeDb }));
jest.unstable_mockModule("@teachanything/db/schema", () => ({
  chatbots,
  conversations,
  messages,
  messageRatings,
  messageRatingEnum: { enumValues: ["up", "down"] },
}));
jest.unstable_mockModule("drizzle-orm", () => ({
  eq: (column: string, value: unknown): Condition => ({
    op: "eq",
    column,
    value,
  }),
  and: (...conditions: Condition[]): Condition => ({ op: "and", conditions }),
  sql: () => "now()",
}));
jest.unstable_mockModule("@/server/rate-limit", () => ({
  publicMessageRatingRateLimit: {},
  checkRateLimit: () => mockLimit(),
}));
jest.unstable_mockModule("@/lib/logger", () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
}));

const { POST } = await import("@/app/api/message-rating/shared/route");

const SHARE_TOKEN = "share-token-1";
const CHATBOT_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_A = "session-aaaaaaaa";
const SESSION_B = "session-bbbbbbbb";
const MESSAGE_A = "aaaaaaaa-0000-4000-8000-000000000001";
const MESSAGE_B = "bbbbbbbb-0000-4000-8000-000000000002";
const USER_MESSAGE_A = "aaaaaaaa-0000-4000-8000-000000000003";

function seed() {
  tables.chatbots = [
    { id: CHATBOT_ID, shareToken: SHARE_TOKEN, sharingEnabled: true },
  ];
  tables.conversations = [
    { id: "conv-a", chatbotId: CHATBOT_ID, sessionId: SESSION_A },
    { id: "conv-b", chatbotId: CHATBOT_ID, sessionId: SESSION_B },
  ];
  tables.messages = [
    { id: MESSAGE_A, conversationId: "conv-a", role: "assistant" },
    { id: USER_MESSAGE_A, conversationId: "conv-a", role: "user" },
    { id: MESSAGE_B, conversationId: "conv-b", role: "assistant" },
  ];
  tables.messageRatings = [];
}

function rate(body: Record<string, unknown>): Promise<Response> {
  return POST(
    new Request("http://localhost/api/message-rating/shared", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "1.2.3.4" },
      body: JSON.stringify({
        shareToken: SHARE_TOKEN,
        sessionId: SESSION_A,
        messageId: MESSAGE_A,
        rating: "up",
        ...body,
      }),
    }),
  );
}

beforeEach(() => {
  seed();
  mockLimit.mockResolvedValue({ success: true });
});

describe("POST /api/message-rating/shared", () => {
  it("saves a rating for a message in the student's session", async () => {
    const res = await rate({ rating: "up" });

    expect(res.status).toBe(204);
    expect(tables.messageRatings).toEqual([
      expect.objectContaining({
        messageId: MESSAGE_A,
        chatbotId: CHATBOT_ID,
        sessionId: SESSION_A,
        rating: "up",
      }),
    ]);
  });

  it("re-rating keeps one row with the latest value", async () => {
    expect((await rate({ rating: "up" })).status).toBe(204);
    expect((await rate({ rating: "down" })).status).toBe(204);

    expect(tables.messageRatings).toHaveLength(1);
    expect(tables.messageRatings[0]).toEqual(
      expect.objectContaining({ messageId: MESSAGE_A, rating: "down" }),
    );
  });

  it("returns 404 for another session's message and saves nothing", async () => {
    const res = await rate({ messageId: MESSAGE_B });

    expect(res.status).toBe(404);
    expect(tables.messageRatings).toHaveLength(0);
  });

  it("returns 404 for a message that isn't persisted yet", async () => {
    const res = await rate({
      messageId: "cccccccc-0000-4000-8000-000000000009",
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 for the student's own user message", async () => {
    const res = await rate({ messageId: USER_MESSAGE_A });

    expect(res.status).toBe(404);
    expect(tables.messageRatings).toHaveLength(0);
  });

  it("returns 404 when sharing is disabled", async () => {
    tables.chatbots[0]!.sharingEnabled = false;

    const res = await rate({});

    expect(res.status).toBe(404);
    expect(tables.messageRatings).toHaveLength(0);
  });

  it("returns 429 when rate limited and saves nothing", async () => {
    mockLimit.mockResolvedValue({ success: false });

    const res = await rate({});

    expect(res.status).toBe(429);
    expect(tables.messageRatings).toHaveLength(0);
  });

  it.each([
    ["an unknown rating", { rating: "meh" }],
    ["a non-uuid message id", { messageId: "msg-1" }],
    ["a malformed session id", { sessionId: "bad id!" }],
  ])("returns 400 for %s", async (_label, body) => {
    const res = await rate(body);

    expect(res.status).toBe(400);
  });

  it("returns 500 without leaking details when the database fails", async () => {
    const insert = fakeDb.insert;
    fakeDb.insert = () => {
      throw new Error("connection reset");
    };
    try {
      const res = await rate({});

      expect(res.status).toBe(500);
      expect(await res.text()).toBe("Failed to save rating");
    } finally {
      fakeDb.insert = insert;
    }
  });
});
