/**
 * @jest-environment node
 *
 * Verifies the split env-validation paths introduced in email.ts:
 *   - requireContactEnv  — used by subscribe + list (needs AUDIENCE_ID only)
 *   - requireBroadcastEnv — used by sendBroadcast  (needs AUDIENCE_ID + FROM_EMAIL)
 *
 * This file mocks RESEND_FROM_EMAIL as absent so we can confirm that:
 *   • subscribeToNewsletter succeeds (does NOT require FROM_EMAIL)
 *   • listNewsletterSubscribers succeeds (does NOT require FROM_EMAIL)
 *   • sendNewsletterBroadcast throws "RESEND_FROM_EMAIL is not configured"
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.SKIP_ENV_VALIDATION = "1";

// ---------------------------------------------------------------------------
// Module-level mock functions
// ---------------------------------------------------------------------------
const mockContactsCreate = jest.fn();
const mockContactsList = jest.fn();

// ---------------------------------------------------------------------------
// Mocks — RESEND_FROM_EMAIL intentionally absent
// ---------------------------------------------------------------------------
jest.unstable_mockModule("resend", () => ({
  Resend: jest.fn(() => ({
    contacts: { create: mockContactsCreate, list: mockContactsList },
  })),
}));

jest.unstable_mockModule("@/lib/env", () => ({
  env: {
    RESEND_API_KEY: "re_test_key",
    RESEND_AUDIENCE_ID: "aud-test-123",
    // RESEND_FROM_EMAIL is intentionally absent to test the split
    NEXT_PUBLIC_CONTACT_EMAIL: "support@example.com",
    ADMIN_EMAILS: "admin@example.com",
  },
  getAdminEmails: jest.fn(() => ["admin@example.com"]),
  isServiceAvailable: jest.fn(() => false),
}));

jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

jest.unstable_mockModule("@/lib/qstash", () => ({
  publishEmailJob: jest.fn(),
}));

jest.unstable_mockModule("@teachanything/db", () => ({
  db: {
    insert: jest.fn(),
    update: jest.fn(),
    select: jest.fn(),
  },
}));

jest.unstable_mockModule("@teachanything/db/schema", () => ({
  user: {},
  emailDeliveries: {},
  emailTypeEnum: { enumValues: [] },
}));

// ---------------------------------------------------------------------------
// Dynamic imports — must come after all unstable_mockModule calls
// ---------------------------------------------------------------------------
const {
  subscribeToNewsletter,
  listNewsletterSubscribers,
  sendNewsletterBroadcast,
} = await import("@/lib/email");

const resendMod = await import("resend");
const MockResend = resendMod.Resend as jest.Mock;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("env validation split — contact-only path (no FROM_EMAIL)", () => {
  beforeEach(() => {
    MockResend.mockImplementation(() => ({
      contacts: { create: mockContactsCreate, list: mockContactsList },
    }));
  });

  it("subscribeToNewsletter succeeds when RESEND_FROM_EMAIL is absent", async () => {
    mockContactsCreate.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      subscribeToNewsletter({ email: "user@example.com" }),
    ).resolves.toBeUndefined();

    expect(mockContactsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ audienceId: "aud-test-123" }),
    );
  });

  it("listNewsletterSubscribers succeeds when RESEND_FROM_EMAIL is absent", async () => {
    mockContactsList.mockResolvedValueOnce({ data: { data: [] }, error: null });

    await expect(listNewsletterSubscribers()).resolves.toEqual([]);
  });
});

describe("env validation split — broadcast path requires FROM_EMAIL", () => {
  it("sendNewsletterBroadcast throws when RESEND_FROM_EMAIL is absent", async () => {
    await expect(
      sendNewsletterBroadcast({ subject: "Sub", body: "Body" }),
    ).rejects.toThrow("RESEND_FROM_EMAIL is not configured");
  });
});
