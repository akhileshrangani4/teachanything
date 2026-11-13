/**
 * @jest-environment node
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";

// Stand-in for the conditional UPDATE in turn-marker.ts: same contract (write
// only when the stored marker equals `expected`), backed by a map.
const markers = new Map<string, string | null>();
async function fakeSwap(
  _database: unknown,
  conversationId: string,
  expected: string | null,
  next: string | null,
): Promise<boolean> {
  if ((markers.get(conversationId) ?? null) !== expected) return false;
  markers.set(conversationId, next);
  return true;
}
const swapTurnMarker = jest.fn<typeof fakeSwap>();
const logError = jest.fn();

jest.unstable_mockModule("@/server/chat/turn-marker", () => ({
  swapTurnMarker,
}));
jest.unstable_mockModule("@/lib/logger", () => ({ logError }));

const { claimTurn, isTurnInFlight, TURN_LEASE_MS } =
  await import("@/server/chat/turn-lease");

const database = {} as Parameters<typeof claimTurn>[0];
const T0 = Date.parse("2026-11-13T12:00:00.000Z");

/** The conversation row as resolveConversation would read it. */
function readConversation(id: string) {
  const activeTurnAt = markers.get(id) ?? undefined;
  return { id, metadata: activeTurnAt ? { activeTurnAt } : {} };
}

beforeEach(() => {
  markers.clear();
  // Re-armed per test: the config's `resetMocks` wipes implementations.
  swapTurnMarker.mockImplementation(fakeSwap);
  jest.useFakeTimers({ now: T0 });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("isTurnInFlight", () => {
  it("is free without a marker", () => {
    expect(isTurnInFlight(undefined, T0)).toBe(false);
    expect(isTurnInFlight(null, T0)).toBe(false);
  });

  it("holds the session until the lease runs out", () => {
    const claimed = new Date(T0).toISOString();
    expect(isTurnInFlight(claimed, T0 + TURN_LEASE_MS - 1)).toBe(true);
    expect(isTurnInFlight(claimed, T0 + TURN_LEASE_MS)).toBe(false);
  });

  it("ignores an unreadable marker", () => {
    expect(isTurnInFlight("not a date", T0)).toBe(false);
  });
});

describe("claimTurn", () => {
  it("lets one of two turns claim a session at once", async () => {
    // Both turns read the session before either claimed it.
    const first = readConversation("c1");
    const second = readConversation("c1");

    const [a, b] = await Promise.all([
      claimTurn(database, first),
      claimTurn(database, second),
    ]);

    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(markers.get("c1")).toBe(new Date(T0).toISOString());
  });

  it("refuses a session whose marker is still live", async () => {
    expect(await claimTurn(database, readConversation("c1"))).not.toBeNull();

    jest.advanceTimersByTime(TURN_LEASE_MS - 1_000);

    expect(await claimTurn(database, readConversation("c1"))).toBeNull();
  });

  it("takes over a marker older than the lease", async () => {
    const crashed = await claimTurn(database, readConversation("c1"));
    expect(crashed).not.toBeNull();

    jest.advanceTimersByTime(TURN_LEASE_MS + 1_000);

    const next = await claimTurn(database, readConversation("c1"));
    expect(next).not.toBeNull();
    expect(markers.get("c1")).toBe(new Date(Date.now()).toISOString());
  });

  it("doesn't let sessions block each other", async () => {
    expect(await claimTurn(database, readConversation("c1"))).not.toBeNull();
    expect(await claimTurn(database, readConversation("c2"))).not.toBeNull();
  });

  it("frees the session on release", async () => {
    const lease = await claimTurn(database, readConversation("c1"));
    await lease!.release();

    expect(markers.get("c1")).toBeNull();
    expect(await claimTurn(database, readConversation("c1"))).not.toBeNull();
  });

  it("releases once, however many exit paths call it", async () => {
    const lease = await claimTurn(database, readConversation("c1"));
    swapTurnMarker.mockClear();

    await Promise.all([lease!.release(), lease!.release()]);
    await lease!.release();

    expect(swapTurnMarker).toHaveBeenCalledTimes(1);
  });

  it("leaves alone a later turn that took over an expired marker", async () => {
    const stale = await claimTurn(database, readConversation("c1"));
    jest.advanceTimersByTime(TURN_LEASE_MS + 1_000);
    await claimTurn(database, readConversation("c1"));
    const takenOver = markers.get("c1");

    await stale!.release();

    expect(markers.get("c1")).toBe(takenOver);
  });

  it("logs a failed release instead of throwing", async () => {
    const lease = await claimTurn(database, readConversation("c1"));
    swapTurnMarker.mockRejectedValueOnce(new Error("connection reset"));

    await expect(lease!.release()).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(
      expect.any(Error),
      "Failed to release chat turn",
      { conversationId: "c1" },
    );
  });
});

describe("TURN_LEASE_MS", () => {
  // A lease shorter than the chat routes' budget would let a second turn take
  // over a session whose first turn is still streaming; a longer one keeps a
  // crashed turn's session locked after its function was already killed. Read
  // the routes' literals: Next.js needs `maxDuration` to stay a literal there.
  it.each(["src/app/api/chat/route.ts", "src/app/api/chat/shared/route.ts"])(
    "equals the maxDuration of %s",
    (route) => {
      const source = readFileSync(join(process.cwd(), route), "utf8");
      const match = source.match(/export const maxDuration = (\d+)\s*;/);
      expect(match).not.toBeNull();
      expect(TURN_LEASE_MS).toBe(Number(match![1]) * 1000);
    },
  );
});
