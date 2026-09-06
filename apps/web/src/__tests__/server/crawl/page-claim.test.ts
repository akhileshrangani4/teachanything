/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// packages/db's client throws at import time without a DATABASE_URL, and the
// schema module pulls it in. Set the env first, then import dynamically --
// static imports are hoisted above these assignments. Neither the client nor
// the network is exercised here: this suite reads an enum and two constants.
process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const { crawledPageStatusEnum } = await import("@teachanything/db/schema");
const { CLAIMABLE_PAGE_STATUSES, PROCESSING_LEASE_MS } =
  await import("@/server/crawl-processor/content-pipeline");

const ALL_STATUSES = crawledPageStatusEnum.enumValues;

/** Statuses reclaimable only once the holder's lease has expired. */
const LEASED = ["processing"] as const;
/** Statuses that have settled and are never reclaimed. */
const SETTLED = ["completed", "skipped", "blocked"] as const;

describe("CLAIMABLE_PAGE_STATUSES", () => {
  it("claims exactly the two dispatchable states outright", () => {
    expect([...CLAIMABLE_PAGE_STATUSES].sort()).toEqual(["failed", "pending"]);
  });

  // `processing` is claimable only through the lease branch of the predicate,
  // never unconditionally. Putting it in this set would let a duplicate QStash
  // delivery re-enter a page a live worker holds, and both would allocate a
  // userFiles row -- the orphan bug the conditional claim exists to prevent.
  it("never claims a live processing page unconditionally", () => {
    for (const leased of LEASED) {
      expect(CLAIMABLE_PAGE_STATUSES).not.toContain(leased);
    }
  });

  it("refuses pages that already settled", () => {
    for (const settled of SETTLED) {
      expect(CLAIMABLE_PAGE_STATUSES).not.toContain(settled);
    }
  });

  // Enum completeness: if someone adds a status to crawled_page_status, this
  // fails and forces an explicit claim / lease / refuse decision rather than
  // letting the new value default into the refused set unnoticed.
  it("accounts for every value in the crawled_page_status enum", () => {
    expect([...CLAIMABLE_PAGE_STATUSES, ...LEASED, ...SETTLED].sort()).toEqual(
      [...ALL_STATUSES].sort(),
    );
  });
});

describe("PROCESSING_LEASE_MS", () => {
  // The one relationship that silently reintroduces the orphan bug if broken.
  // A lease shorter than the page job's own function budget means a retry can
  // reclaim a page whose first worker is still running and still about to
  // insert. Read the route's literal rather than hardcoding 300 here, so
  // raising maxDuration fails this test instead of quietly invalidating the
  // lease. The value has to stay a literal in the route for Next.js to
  // statically analyse it, which is why it cannot simply be imported.
  it("outlasts the crawl-process-page function budget", () => {
    const routeSource = readFileSync(
      join(process.cwd(), "src/app/api/jobs/crawl-process-page/route.ts"),
      "utf8",
    );
    const match = routeSource.match(/export const maxDuration = (\d+)\s*;/);
    expect(match).not.toBeNull();

    const maxDurationMs = Number(match![1]) * 1000;
    expect(maxDurationMs).toBeGreaterThan(0);
    expect(PROCESSING_LEASE_MS).toBeGreaterThan(maxDurationMs);
  });

  it("is short enough to beat the stale sweep to the recovery", async () => {
    // Otherwise the lease is pointless: sweepStaleCrawls would already have
    // marked the page failed before a retry could ever reclaim it.
    const { STALE_CRAWL_MS } = await import("@/server/crawl-stale");
    expect(PROCESSING_LEASE_MS).toBeLessThan(STALE_CRAWL_MS);
  });
});
