/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const { authRouter } = await import("@/server/routers/auth");

describe("auth router", () => {
  // `checkUserStatus` told anonymous callers whether an email was registered
  // and its approval state (#480). Approval state now reaches the login page
  // only through the session gate, after the password has been verified.
  it("does not expose an anonymous account status lookup", () => {
    expect(Object.keys(authRouter._def.procedures)).not.toContain(
      "checkUserStatus",
    );
  });

  it("keeps the procedures the app still calls", () => {
    expect(Object.keys(authRouter._def.procedures).sort()).toEqual([
      "checkApprovalStatus",
      "deleteOwnAccount",
      "getProfile",
      "getStatus",
      "updateName",
      "updatePassword",
      "updatePreferredLocale",
      "updateProfile",
    ]);
  });
});
