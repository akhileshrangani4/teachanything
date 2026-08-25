/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";

// packages/db's client throws at import time without a DATABASE_URL, and the
// schema module pulls it in. Set the env first, then import dynamically --
// static imports are hoisted above these assignments. Neither the client nor
// the network is exercised here: this suite reads an enum and a constant.
process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const { crawledPageStatusEnum } = await import("@teachanything/db/schema");
const { CLAIMABLE_PAGE_STATUSES } =
  await import("@/server/crawl-processor/content-pipeline");

const ALL_STATUSES = crawledPageStatusEnum.enumValues;

describe("CLAIMABLE_PAGE_STATUSES", () => {
  it("claims exactly the two dispatchable states", () => {
    expect([...CLAIMABLE_PAGE_STATUSES].sort()).toEqual(["failed", "pending"]);
  });

  // Re-entering a page another worker holds is what lets two QStash
  // deliveries both allocate a userFiles row and orphan the loser.
  it("refuses a page another worker is already processing", () => {
    expect(CLAIMABLE_PAGE_STATUSES).not.toContain("processing");
  });

  it("refuses pages that already settled", () => {
    for (const settled of ["completed", "skipped", "blocked"] as const) {
      expect(CLAIMABLE_PAGE_STATUSES).not.toContain(settled);
    }
  });

  // Enum completeness: if someone adds a status to crawled_page_status, this
  // fails and forces an explicit claim/refuse decision rather than letting the
  // new value default into the refused set unnoticed.
  it("accounts for every value in the crawled_page_status enum", () => {
    const refused = ALL_STATUSES.filter(
      (s) => !(CLAIMABLE_PAGE_STATUSES as readonly string[]).includes(s),
    );
    expect([...CLAIMABLE_PAGE_STATUSES, ...refused].sort()).toEqual(
      [...ALL_STATUSES].sort(),
    );
    expect(refused.sort()).toEqual(
      ["blocked", "completed", "processing", "skipped"].sort(),
    );
  });
});
