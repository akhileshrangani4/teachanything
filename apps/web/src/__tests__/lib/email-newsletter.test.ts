/**
 * @jest-environment node
 *
 * Node environment avoids jsdom browser-condition resolution on react-dom/server.
 * We also prevent @teachanything/db from throwing by setting the env vars before
 * module evaluation, and mock the whole package with jest.unstable_mockModule so
 * the real postgres connection is never attempted.
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Prevent packages/db/src/db.ts from throwing at import time
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.SKIP_ENV_VALIDATION = "1";

// ---------------------------------------------------------------------------
// Module-level mock functions (captured by reference in factory closures)
// ---------------------------------------------------------------------------
const mockContactsCreate = jest.fn();
const mockContactsList = jest.fn();

// ---------------------------------------------------------------------------
// Mocks — use jest.unstable_mockModule for ESM-compiled local/monorepo modules
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
// subscribeToNewsletter
// ---------------------------------------------------------------------------

describe("subscribeToNewsletter", () => {
  beforeEach(() => {
    // resetMocks:true clears implementations between tests; re-establish Resend
    MockResend.mockImplementation(() => ({
      contacts: { create: mockContactsCreate, list: mockContactsList },
    }));
  });

  it("calls contacts.create with audienceId and email", async () => {
    mockContactsCreate.mockResolvedValueOnce({ data: null, error: null });

    await subscribeToNewsletter({ email: "user@example.com" });

    expect(mockContactsCreate).toHaveBeenCalledWith({
      audienceId: "aud-test-123",
      email: "user@example.com",
      firstName: undefined,
      unsubscribed: false,
    });
  });

  it("passes optional firstName to contacts.create", async () => {
    mockContactsCreate.mockResolvedValueOnce({ data: null, error: null });

    await subscribeToNewsletter({
      email: "user@example.com",
      firstName: "Alice",
    });

    expect(mockContactsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: "Alice" }),
    );
  });

  it("throws when Resend returns an error", async () => {
    mockContactsCreate.mockResolvedValueOnce({
      data: null,
      error: { message: "Contact already exists", name: "conflict_error" },
    });

    await expect(
      subscribeToNewsletter({ email: "user@example.com" }),
    ).rejects.toThrow("Contact already exists");
  });
});

// ---------------------------------------------------------------------------
// listNewsletterSubscribers
// ---------------------------------------------------------------------------

type RawResendContact = {
  id: string;
  email: string;
  first_name: string | undefined;
  last_name: string | undefined;
  created_at: string;
  unsubscribed: boolean;
};

describe("listNewsletterSubscribers", () => {
  beforeEach(() => {
    MockResend.mockImplementation(() => ({
      contacts: { create: mockContactsCreate, list: mockContactsList },
    }));
  });

  it("maps Resend contact fields to NewsletterContact shape", async () => {
    const raw: RawResendContact = {
      id: "contact-1",
      email: "alice@example.com",
      first_name: "Alice",
      last_name: "Smith",
      created_at: "2024-01-15T00:00:00.000Z",
      unsubscribed: false,
    };
    mockContactsList.mockResolvedValueOnce({
      data: { data: [raw] },
      error: null,
    });

    const result = await listNewsletterSubscribers();

    expect(result).toEqual([
      {
        id: "contact-1",
        email: "alice@example.com",
        firstName: "Alice",
        lastName: "Smith",
        createdAt: "2024-01-15T00:00:00.000Z",
        unsubscribed: false,
      },
    ]);
  });

  it("maps missing name fields to null", async () => {
    const raw: RawResendContact = {
      id: "contact-2",
      email: "bob@example.com",
      first_name: undefined,
      last_name: undefined,
      created_at: "2024-02-01T00:00:00.000Z",
      unsubscribed: true,
    };
    mockContactsList.mockResolvedValueOnce({
      data: { data: [raw] },
      error: null,
    });

    const result = await listNewsletterSubscribers();

    expect(result[0]!.firstName).toBeNull();
    expect(result[0]!.lastName).toBeNull();
  });

  it("returns an empty array when data.data is absent", async () => {
    mockContactsList.mockResolvedValueOnce({ data: null, error: null });

    const result = await listNewsletterSubscribers();
    expect(result).toEqual([]);
  });

  it("throws when Resend returns an error", async () => {
    mockContactsList.mockResolvedValueOnce({
      data: null,
      error: { message: "Audience not found", name: "not_found_error" },
    });

    await expect(listNewsletterSubscribers()).rejects.toThrow(
      "Audience not found",
    );
  });
});

// ---------------------------------------------------------------------------
// sendNewsletterBroadcast
// ---------------------------------------------------------------------------

describe("sendNewsletterBroadcast", () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it("POSTs to the Resend broadcasts endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "broadcast-abc" }),
    });

    await sendNewsletterBroadcast({
      subject: "Test Subject",
      body: "Test body",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.resend.com/broadcasts",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("builds the correct broadcast request body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "broadcast-abc" }),
    });

    await sendNewsletterBroadcast({
      subject: "Test Subject",
      body: "Test body",
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;

    expect(body.segment_id).toBe("aud-test-123");
    expect(body.send).toBe(true);
    expect(body.subject).toBe("Test Subject");
    expect(typeof body.from).toBe("string");
    expect(body.from as string).toContain("newsletter@example.com");
    expect(typeof body.html).toBe("string");
  });

  it("returns the broadcastId from a successful Resend response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "broadcast-xyz" }),
    });

    const result = await sendNewsletterBroadcast({
      subject: "Sub",
      body: "Body",
    });

    expect(result).toEqual({ broadcastId: "broadcast-xyz" });
  });

  it("throws when Resend returns an error payload", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        statusCode: 422,
        message: "Domain not verified",
        name: "validation_error",
      }),
    });

    await expect(
      sendNewsletterBroadcast({ subject: "Sub", body: "Body" }),
    ).rejects.toThrow("Domain not verified");
  });

  it("throws a network-error message when fetch itself rejects", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Failed to fetch"));

    await expect(
      sendNewsletterBroadcast({ subject: "Sub", body: "Body" }),
    ).rejects.toThrow(/network error/i);
  });

  it("includes the Bearer token in the Authorization header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "broadcast-abc" }),
    });

    await sendNewsletterBroadcast({ subject: "Sub", body: "Body" });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer re_test_key");
  });
});
