/**
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Plain functions over recorded state, not jest.fn implementations: the jest
// config resets those between tests.
let claimResult: boolean | Error = true;
const claims: unknown[][] = [];
jest.unstable_mockModule("@/server/rate-limit", () => ({
  claimLimitWarning: async (...args: unknown[]) => {
    claims.push(args);
    if (claimResult instanceof Error) throw claimResult;
    return claimResult;
  },
}));

let sendError: Error | null = null;
const sent: Record<string, unknown>[] = [];
jest.unstable_mockModule("@/server/email/daily-limit-warning", () => ({
  sendDailyLimitWarningEmail: async (params: Record<string, unknown>) => {
    if (sendError) throw sendError;
    sent.push(params);
  },
}));

const warnings: unknown[][] = [];
jest.unstable_mockModule("@/lib/logger", () => ({
  logWarn: (...args: unknown[]) => warnings.push(args),
}));

const {
  warningThreshold,
  findLimitCrossings,
  sendLimitWarnings,
  warnOnLimitCrossings,
} = await import("@/server/chat/limit-warnings");

const chatbot = { id: "bot-1", name: "Intro Biology", userId: "owner-1" };
const owner = { name: "Ada Lovelace", email: "ada@example.edu" };

/** A db whose owner lookup resolves to `rows`, counting the lookups. */
function ownerDb(rows: unknown[] = [owner]) {
  const reads = { count: 0 };
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            reads.count += 1;
            return rows;
          },
        }),
      }),
    }),
  } as never;
  return { db, reads };
}

beforeEach(() => {
  claimResult = true;
  sendError = null;
  claims.length = 0;
  sent.length = 0;
  warnings.length = 0;
});

describe("warningThreshold", () => {
  it.each([
    // Default chatbot limit 150: 80% is 120.
    [119, 150, null],
    [120, 150, 80],
    [121, 150, null],
    [149, 150, null],
    [150, 150, 100],
    [151, 150, null],
    // Default professor limit 300: 80% is 240.
    [237, 300, null],
    [240, 300, 80],
    [243, 300, null],
    [300, 300, 100],
    // Admin overrides.
    [8, 10, 80],
    [10, 10, 100],
    [9, 10, null],
    // 80% of 7 is 5.6, rounded up to 6.
    [6, 7, 80],
    [5, 7, null],
    // Limits of 1 to 4: 80% rounds up to the limit, so only 100 applies.
    [4, 4, 100],
    [3, 4, null],
    [1, 1, 100],
  ])("count %p of limit %p crosses %p", (count, limit, expected) => {
    expect(warningThreshold(count, limit)).toBe(expected);
  });
});

describe("findLimitCrossings", () => {
  it("reports both scopes when one message crosses both", () => {
    expect(
      findLimitCrossings(
        { chatbot: 8, owner: 300 },
        { chatbot: 10, owner: 300 },
      ),
    ).toEqual([
      { scope: "chatbot", count: 8, limit: 10, threshold: 80 },
      { scope: "owner", count: 300, limit: 300, threshold: 100 },
    ]);
  });

  it("reports nothing between thresholds", () => {
    expect(
      findLimitCrossings(
        { chatbot: 50, owner: 90 },
        { chatbot: 150, owner: 300 },
      ),
    ).toEqual([]);
  });
});

describe("sendLimitWarnings", () => {
  const date = "2026-11-20";

  it("claims the slot, looks up the owner, and emails them", async () => {
    const { db } = ownerDb();
    await sendLimitWarnings(
      db,
      chatbot,
      [
        { scope: "chatbot", count: 120, limit: 150, threshold: 80 },
        { scope: "owner", count: 300, limit: 300, threshold: 100 },
      ],
      date,
    );
    expect(claims).toEqual([
      ["chatbot", "bot-1", 80, date],
      ["owner", "owner-1", 100, date],
    ]);
    expect(sent).toEqual([
      {
        to: owner.email,
        name: owner.name,
        chatbotName: "Intro Biology",
        count: 120,
        limit: 150,
        threshold: 80,
      },
      {
        to: owner.email,
        name: owner.name,
        chatbotName: null,
        count: 300,
        limit: 300,
        threshold: 100,
      },
    ]);
  });

  it("sends nothing, and reads no owner, when the day's slot is taken", async () => {
    claimResult = false;
    const { db, reads } = ownerDb();
    await sendLimitWarnings(
      db,
      chatbot,
      [{ scope: "chatbot", count: 150, limit: 150, threshold: 100 }],
      date,
    );
    expect(sent).toEqual([]);
    expect(reads.count).toBe(0);
  });

  it.each([
    ["Redis", () => (claimResult = new Error("ECONNREFUSED"))],
    ["email delivery", () => (sendError = new Error("QStash down"))],
  ])("logs a %s failure instead of throwing", async (_name, fail) => {
    fail();
    const { db } = ownerDb();
    await expect(
      sendLimitWarnings(
        db,
        chatbot,
        [{ scope: "owner", count: 240, limit: 300, threshold: 80 }],
        date,
      ),
    ).resolves.toBeUndefined();
    expect(warnings).toHaveLength(1);
  });
});

describe("warnOnLimitCrossings", () => {
  const limits = { chatbot: 150, owner: 300 };

  /** Let the fire-and-forget send settle. */
  const settle = () => new Promise((resolve) => setImmediate(resolve));

  it("emails in the background for an admitted message on a threshold", async () => {
    const { db } = ownerDb();
    const result = {
      isAllowed: true,
      counts: { chatbot: 120, owner: 130 },
      date: "2026-11-20",
    };
    expect(warnOnLimitCrossings(db, chatbot, limits, result)).toBeUndefined();
    await settle();
    expect(sent).toHaveLength(1);
  });

  it.each([
    ["a refused message", { isAllowed: false, date: "2026-11-20" }],
    ["no counts (Redis unconfigured)", { isAllowed: true, date: "2026-11-20" }],
  ])("does nothing for %s", async (_name, result) => {
    const { db } = ownerDb();
    warnOnLimitCrossings(db, chatbot, limits, result);
    await settle();
    expect(claims).toEqual([]);
  });

  it("never rejects into the chat path when sending fails", async () => {
    sendError = new Error("QStash down");
    const { db } = ownerDb();
    warnOnLimitCrossings(db, chatbot, limits, {
      isAllowed: true,
      counts: { chatbot: 150, owner: 150 },
      date: "2026-11-20",
    });
    await settle();
    expect(warnings).toHaveLength(1);
  });
});
