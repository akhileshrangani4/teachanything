/**
 * @jest-environment node
 */
import { jest, describe, it, expect } from "@jest/globals";

let session: unknown = null;

jest.unstable_mockModule("@/server/auth", () => ({
  auth: { api: { getSession: async () => session } },
}));
jest.unstable_mockModule("@/lib/logger", () => ({ logWarn: jest.fn() }));

const { requireApprovedUser } = await import("@/server/api-auth");

describe("requireApprovedUser", () => {
  it("names a missing session", async () => {
    session = null;
    const result = await requireApprovedUser(new Headers());
    expect(result).toMatchObject({ ok: false, code: "unauthorized" });
  });

  it("names an unapproved account", async () => {
    session = { user: { id: "u", role: "user", status: "pending" } };
    const result = await requireApprovedUser(new Headers());
    expect(result).toMatchObject({ ok: false, code: "pending_approval" });
  });

  it("lets an approved user through", async () => {
    session = { user: { id: "u", role: "user", status: "approved" } };
    const result = await requireApprovedUser(new Headers());
    expect(result).toMatchObject({ ok: true });
  });
});
