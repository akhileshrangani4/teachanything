/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";

// Set all required environment variables before importing modules
process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.BETTER_AUTH_SECRET = "test-secret";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.OPENROUTER_API_KEY = "test-key";
process.env.OPENAI_API_KEY = "test-key";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.ADMIN_EMAILS = "admin@example.com";
process.env.NEXT_PUBLIC_CONTACT_EMAIL = "support@example.edu";
process.env.RESEND_FROM_EMAIL = "noreply@example.edu";
process.env.QSTASH_TOKEN = "test-token";

describe("email wrappers", () => {
  it("exports sendRequestMoreInfoEmail function", async () => {
    const emailModule = await import("@/lib/email");
    expect(typeof emailModule.sendRequestMoreInfoEmail).toBe("function");
  });

  it("exports sendIncorrectInfoEmail function", async () => {
    const emailModule = await import("@/lib/email");
    expect(typeof emailModule.sendIncorrectInfoEmail).toBe("function");
  });

  it("exports sendGenericAdminEmail function", async () => {
    const emailModule = await import("@/lib/email");
    expect(typeof emailModule.sendGenericAdminEmail).toBe("function");
  });

  it("sendRequestMoreInfoEmail is a callable function", async () => {
    const emailModule = await import("@/lib/email");
    expect(typeof emailModule.sendRequestMoreInfoEmail).toBe("function");
    expect(emailModule.sendRequestMoreInfoEmail.name).toBe(
      "sendRequestMoreInfoEmail",
    );
  });

  it("sendIncorrectInfoEmail is a callable function", async () => {
    const emailModule = await import("@/lib/email");
    expect(typeof emailModule.sendIncorrectInfoEmail).toBe("function");
    expect(emailModule.sendIncorrectInfoEmail.name).toBe(
      "sendIncorrectInfoEmail",
    );
  });

  it("sendGenericAdminEmail is a callable function", async () => {
    const emailModule = await import("@/lib/email");
    expect(typeof emailModule.sendGenericAdminEmail).toBe("function");
    expect(emailModule.sendGenericAdminEmail.name).toBe(
      "sendGenericAdminEmail",
    );
  });
});
