/**
 * @jest-environment node
 */
import { jest, describe, it, expect } from "@jest/globals";

const env: { NEXT_PUBLIC_CONTACT_EMAIL?: string } = {};
jest.unstable_mockModule("@/lib/env", () => ({
  env,
  getAdminEmails: () => ["first-admin@example.org", "second@example.org"],
}));

const { getAdminContactEmail } = await import("@/server/email/support-email");

describe("getAdminContactEmail", () => {
  it("uses the public contact email when set", () => {
    env.NEXT_PUBLIC_CONTACT_EMAIL = "help@example.org";
    expect(getAdminContactEmail()).toBe("help@example.org");
  });

  it("falls back to the first admin email", () => {
    delete env.NEXT_PUBLIC_CONTACT_EMAIL;
    expect(getAdminContactEmail()).toBe("first-admin@example.org");
  });
});
