/**
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const exec = jest.fn<() => Promise<[number, number]>>();
const incr = jest.fn();
const expire = jest.fn();
// Plain functions, not mock implementations: the jest config resets those
// between tests, which would break the chain.
const pipeline = {
  incr: (...args: unknown[]) => (incr(...args), pipeline),
  expire: (...args: unknown[]) => (expire(...args), pipeline),
  exec: () => exec(),
};

jest.unstable_mockModule("@upstash/redis", () => ({
  Redis: class {
    pipeline() {
      return pipeline;
    }
  },
}));
jest.unstable_mockModule("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(class {}, { slidingWindow: () => ({}) }),
}));
jest.unstable_mockModule("@/lib/env", () => ({
  isServiceAvailable: () => true,
  env: { UPSTASH_REDIS_REST_URL: "https://x", UPSTASH_REDIS_REST_TOKEN: "t" },
}));
const logWarn = jest.fn();
jest.unstable_mockModule("@/lib/logger", () => ({ logWarn }));

const { consumeDailyMessage, easternDateKey } =
  await import("@/server/rate-limit");

describe("easternDateKey", () => {
  it.each([
    // EST (UTC-5): the Eastern day turns at 05:00 UTC.
    ["2026-11-18T04:59:59Z", "2026-11-17"],
    ["2026-11-18T05:00:00Z", "2026-11-18"],
    // EDT (UTC-4): the Eastern day turns at 04:00 UTC.
    ["2026-07-01T03:59:59Z", "2026-06-30"],
    ["2026-07-01T04:00:00Z", "2026-07-01"],
    // The day after clocks fall back (Nov 1 2026) still turns at midnight.
    ["2026-11-02T04:59:59Z", "2026-11-01"],
    ["2026-11-02T05:00:00Z", "2026-11-02"],
  ])("%s falls on %s Eastern", (iso, expected) => {
    expect(easternDateKey(new Date(iso))).toBe(expected);
  });
});

describe("consumeDailyMessage", () => {
  const now = new Date("2026-11-17T15:00:00Z");
  const chatbot = { id: "bot-1", ownerId: "owner-1" };
  const limits = { chatbot: 150, owner: 300 };
  const chatbotKey = "@ratelimit/chatbot-daily:bot-1:2026-11-17";
  const ownerKey = "@ratelimit/owner-daily:owner-1:2026-11-17";

  /** Script the counts each INCR returns, in call order. */
  function counts(...values: number[]) {
    for (const value of values) exec.mockResolvedValueOnce([value, 1]);
  }

  beforeEach(() => {
    exec.mockReset();
    incr.mockClear();
    expire.mockClear();
    logWarn.mockClear();
  });

  it("counts against the chatbot, then the owner, for the Eastern date", async () => {
    counts(1, 1);
    await consumeDailyMessage(chatbot, limits, now);
    expect(incr.mock.calls).toEqual([[chatbotKey], [ownerKey]]);
    expect(expire).toHaveBeenCalledWith(chatbotKey, 48 * 60 * 60);
    expect(expire).toHaveBeenCalledWith(ownerKey, 48 * 60 * 60);
  });

  it("allows messages up to and including both limits", async () => {
    counts(150, 300);
    await expect(consumeDailyMessage(chatbot, limits, now)).resolves.toBe(true);
    expect(logWarn).not.toHaveBeenCalled();
  });

  it("refuses past the chatbot limit without charging the owner", async () => {
    counts(151);
    await expect(consumeDailyMessage(chatbot, limits, now)).resolves.toBe(
      false,
    );
    expect(incr.mock.calls).toEqual([[chatbotKey]]);
  });

  it("refuses past the owner limit", async () => {
    counts(10, 301);
    await expect(consumeDailyMessage(chatbot, limits, now)).resolves.toBe(
      false,
    );
  });

  it("logs only the first refusal of the day", async () => {
    counts(151, 152);
    await consumeDailyMessage(chatbot, limits, now);
    await consumeDailyMessage(chatbot, limits, now);
    expect(logWarn).toHaveBeenCalledTimes(1);
  });

  it("fails open when Redis errors", async () => {
    exec.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(consumeDailyMessage(chatbot, limits, now)).resolves.toBe(true);
    expect(logWarn).toHaveBeenCalledTimes(1);
  });
});
