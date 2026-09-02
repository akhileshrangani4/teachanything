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

const { enforceAllowedDomain } = await import("@/server/auth/domain-check");

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

  // The match is `emailDomain.endsWith(domain)` where emailDomain keeps its
  // leading "@". An entry written WITH the "@" therefore anchors correctly,
  // while a bare "gwu.edu" entry also matches any lookalike ending in it.
  // Both cases are pinned here so a future change to the matcher is a
  // deliberate one rather than a silent widening or narrowing.
  it("anchors on the @ when the allowlist entry includes it", async () => {
    mockGetApprovedDomains.mockReturnValue(["@gwu.edu"]);
    await expect(
      enforceAllowedDomain({ email: "attacker@evil-gwu.edu" }),
    ).rejects.toThrow(/not authorized for registration/);
  });

  it("admits a lookalike when the allowlist entry omits the @", async () => {
    mockGetApprovedDomains.mockReturnValue(["gwu.edu"]);
    await expect(
      enforceAllowedDomain({ email: "attacker@evil-gwu.edu" }),
    ).resolves.toBeUndefined();
  });

  it("matches subdomains of an allowlisted suffix", async () => {
    mockGetApprovedDomains.mockReturnValue([".edu"]);
    await expect(
      enforceAllowedDomain({ email: "student@cs.gwu.edu" }),
    ).resolves.toBeUndefined();
  });
});
