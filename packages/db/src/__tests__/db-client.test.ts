import { jest, describe, it, expect } from "@jest/globals";

/**
 * Pins the connection options, because getting these wrong fails ONLY in
 * production.
 *
 * Production connects through Supabase's transaction-mode pooler on port 6543,
 * where a connection moves between backends across statements. Local
 * development uses port 5432 (session mode), where prepared statements behave
 * normally. So `prepare: true` passes every local run and every test, then
 * throws `Failed query: ...` on ordinary statements once deployed. A silent
 * regression here is invisible until users cannot retry or delete a file.
 */
process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/test";

// Captured in a plain array, not a jest.fn: `db.ts` calls postgres() at module
// scope during import, and jest's mock-reset between tests would wipe a spy's
// recorded call before any assertion could read it.
const calls: Array<[string, Record<string, unknown> | undefined]> = [];

jest.unstable_mockModule("postgres", () => ({
  __esModule: true,
  default: (url: string, opts?: Record<string, unknown>) => {
    calls.push([url, opts]);
    return {} as never;
  },
}));
jest.unstable_mockModule("drizzle-orm/postgres-js", () => ({
  drizzle: jest.fn(() => ({}) as never),
}));

await import("../db");

describe("database client options", () => {
  const options = () => calls[0]?.[1] ?? {};

  it("is constructed with an options object at all", () => {
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[1]).toBeDefined();
  });

  it("disables prepared statements for the transaction-mode pooler", () => {
    expect(options().prepare).toBe(false);
  });

  it("caps the per-instance pool below the postgres.js default of 10", () => {
    const max = options().max as number;
    expect(typeof max).toBe("number");
    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThan(10);
  });

  it("sets an idle timeout so serverless instances release connections", () => {
    expect(options().idle_timeout).toBeGreaterThan(0);
  });
});
