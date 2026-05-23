/**
 * @jest-environment node
 *
 * Verifies newsletter contact operations use RESEND_AUDIENCE_ID while
 * broadcasts require a separate RESEND_BROADCAST_SEGMENT_ID.
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.SKIP_ENV_VALIDATION = "1";

const mockContactsCreate = jest.fn();
const mockContactsList = jest.fn();

jest.unstable_mockModule("resend", () => ({
  Resend: jest.fn(() => ({
    contacts: { create: mockContactsCreate, list: mockContactsList },
  })),
}));

jest.unstable_mockModule("@/lib/env", () => ({
  env: {
    RESEND_API_KEY: "re_test_key",
    RESEND_AUDIENCE_ID: "aud-test-123",
    RESEND_FROM_EMAIL: "newsletter@example.com",
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

const {
  subscribeToNewsletter,
  listNewsletterSubscribers,
  sendNewsletterBroadcast,
} = await import("@/lib/email");

const resendMod = await import("resend");
const MockResend = resendMod.Resend as jest.Mock;

describe("newsletter broadcast segment env", () => {
  beforeEach(() => {
    MockResend.mockImplementation(() => ({
      contacts: { create: mockContactsCreate, list: mockContactsList },
    }));
  });

  it("keeps contact operations on RESEND_AUDIENCE_ID without a segment id", async () => {
    mockContactsCreate.mockResolvedValueOnce({ data: null, error: null });
    mockContactsList.mockResolvedValueOnce({ data: { data: [] }, error: null });

    await expect(
      subscribeToNewsletter({ email: "user@example.com" }),
    ).resolves.toBeUndefined();
    await expect(listNewsletterSubscribers()).resolves.toEqual([]);

    expect(mockContactsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ audienceId: "aud-test-123" }),
    );
    expect(mockContactsList).toHaveBeenCalledWith({
      audienceId: "aud-test-123",
    });
  });

  it("requires RESEND_BROADCAST_SEGMENT_ID for newsletter broadcasts", async () => {
    await expect(
      sendNewsletterBroadcast({ subject: "Sub", body: "Body" }),
    ).rejects.toThrow("RESEND_BROADCAST_SEGMENT_ID is not configured");
  });
});
