/**
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const mockDbDomains = jest.fn<() => Promise<{ domain: string }[]>>();
const mockGetApprovedDomains = jest.fn<() => string[]>();

jest.unstable_mockModule("@teachanything/db", () => ({
  db: { select: () => ({ from: mockDbDomains }) },
}));

jest.unstable_mockModule("@/lib/env", () => ({
  getApprovedDomains: mockGetApprovedDomains,
}));

jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

const { enforceAllowedDomain, matchesAllowedDomain } =
  await import("@/server/auth/domain-check");

describe("enforceAllowedDomain", () => {
  beforeEach(() => {
    mockDbDomains.mockResolvedValue([]);
    mockGetApprovedDomains.mockReturnValue([]);
  });

  it("allows any address when no domains are configured at all", async () => {
    await expect(
      enforceAllowedDomain({ email: "anyone@anywhere.example" }),
    ).resolves.toBeUndefined();
  });

  it("allows an address matching an env-configured domain", async () => {
    mockGetApprovedDomains.mockReturnValue(["@gwu.edu"]);
    await expect(
      enforceAllowedDomain({ email: "student@gwu.edu" }),
    ).resolves.toBeUndefined();
  });

  it("allows an address matching a database-configured domain", async () => {
    mockDbDomains.mockResolvedValue([{ domain: ".edu" }]);
    await expect(
      enforceAllowedDomain({ email: "student@mit.edu" }),
    ).resolves.toBeUndefined();
  });

  it("rejects an address outside a non-empty allowlist", async () => {
    mockGetApprovedDomains.mockReturnValue(["@gwu.edu"]);
    await expect(
      enforceAllowedDomain({ email: "attacker@evil.example" }),
    ).rejects.toThrow(/not authorized for registration/);
  });

  it("rejects when the allowlist is non-empty but only from the database", async () => {
    mockDbDomains.mockResolvedValue([{ domain: "@gwu.edu" }]);
    await expect(
      enforceAllowedDomain({ email: "attacker@evil.example" }),
    ).rejects.toThrow(/not authorized for registration/);
  });

  // Matching is on a label boundary, so a lookalike is refused whether or not
  // the allowlist entry was written with a leading "@".
  it("refuses a lookalike domain for an entry written with the @", async () => {
    mockGetApprovedDomains.mockReturnValue(["@gwu.edu"]);
    await expect(
      enforceAllowedDomain({ email: "attacker@evil-gwu.edu" }),
    ).rejects.toThrow(/not authorized for registration/);
  });

  it("refuses a lookalike domain for an entry written without the @", async () => {
    mockGetApprovedDomains.mockReturnValue(["gwu.edu"]);
    await expect(
      enforceAllowedDomain({ email: "attacker@evil-gwu.edu" }),
    ).rejects.toThrow(/not authorized for registration/);
  });

  it("matches subdomains of an allowlisted suffix", async () => {
    mockGetApprovedDomains.mockReturnValue([".edu"]);
    await expect(
      enforceAllowedDomain({ email: "student@cs.gwu.edu" }),
    ).resolves.toBeUndefined();
  });

  // ALLOWED_EMAIL_DOMAINS="" (an operator disabling the allowlist) and a
  // trailing comma both put a blank entry in the list. getApprovedDomains does
  // not filter, so the blank has to be dropped before the "is the list empty"
  // gate: otherwise the gate is armed by an entry that matches nothing and
  // every registration on the instance is refused.
  it("treats an all-blank allowlist as no allowlist", async () => {
    for (const domains of [[""], ["", "  "], ["   "]]) {
      mockGetApprovedDomains.mockReturnValue(domains);
      await expect(
        enforceAllowedDomain({ email: "anyone@example.com" }),
      ).resolves.toBeUndefined();
    }
  });

  it("ignores a blank entry without disarming the real ones", async () => {
    mockGetApprovedDomains.mockReturnValue([".edu", ""]);
    await expect(
      enforceAllowedDomain({ email: "student@gwu.edu" }),
    ).resolves.toBeUndefined();
    await expect(
      enforceAllowedDomain({ email: "attacker@example.com" }),
    ).rejects.toThrow(/not authorized for registration/);
  });

  it("is case-insensitive on both sides", async () => {
    mockGetApprovedDomains.mockReturnValue(["@GWU.edu"]);
    await expect(
      enforceAllowedDomain({ email: "Student@Gwu.EDU" }),
    ).resolves.toBeUndefined();
  });
});

describe("matchesAllowedDomain", () => {
  it("accepts the exact host for a specific-domain entry", () => {
    for (const entry of ["gwu.edu", "@gwu.edu", " GWU.edu "]) {
      expect(matchesAllowedDomain("gwu.edu", entry)).toBe(true);
    }
  });

  it("accepts a subdomain of a specific-domain entry", () => {
    expect(matchesAllowedDomain("cs.gwu.edu", "gwu.edu")).toBe(true);
  });

  // The bug this function exists to close.
  it("refuses a host that merely ends with the entry text", () => {
    expect(matchesAllowedDomain("evil-gwu.edu", "gwu.edu")).toBe(false);
    expect(matchesAllowedDomain("notgwu.edu", "@gwu.edu")).toBe(false);
  });

  it("treats a dotted or bare TLD entry as a wildcard", () => {
    expect(matchesAllowedDomain("gwu.edu", ".edu")).toBe(true);
    expect(matchesAllowedDomain("gwu.edu", "edu")).toBe(true);
    // A TLD wildcard is meant to admit every institution under it, lookalike
    // names included -- that is what ".edu" asks for.
    expect(matchesAllowedDomain("evil-gwu.edu", ".edu")).toBe(true);
    expect(matchesAllowedDomain("gwu.com", ".edu")).toBe(false);
  });

  it("refuses an empty or whitespace entry", () => {
    expect(matchesAllowedDomain("gwu.edu", "")).toBe(false);
    expect(matchesAllowedDomain("gwu.edu", "   ")).toBe(false);
    expect(matchesAllowedDomain("gwu.edu", "@")).toBe(false);
  });
});
