import { jest, describe, it, expect, beforeEach } from "@jest/globals";

type CreateContactPayload = {
  audienceId: string;
  email: string;
  firstName?: string;
};

type CreateContactResponse = {
  data: { object: string; id: string } | null;
  error: { name: string; message: string } | null;
};

// Mock external dependencies before importing the module under test.
// Mocks are held in test-scope variables (closed over by the factories);
// implementations are (re)established in beforeEach because jest.config
// sets resetMocks: true.
const mockContactsCreate =
  jest.fn<(payload: CreateContactPayload) => Promise<CreateContactResponse>>();
const mockResend = jest.fn();
const mockIsServiceAvailable = jest.fn<(service: string) => boolean>();
const mockEnv: { RESEND_API_KEY?: string; RESEND_AUDIENCE_ID?: string } = {};
const mockLogWarn = jest.fn();
const mockLogError = jest.fn();

// Use unstable_mockModule for ESM compatibility
jest.unstable_mockModule("resend", () => ({ Resend: mockResend }));

jest.unstable_mockModule("@/lib/env", () => ({
  env: mockEnv,
  isServiceAvailable: mockIsServiceAvailable,
}));

jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logWarn: mockLogWarn,
  logError: mockLogError,
}));

// Dynamic import after mocks are set up
const { syncUserToResendAudience } = await import("@/lib/resend-audience");

describe("syncUserToResendAudience", () => {
  beforeEach(() => {
    mockResend.mockImplementation(() => ({
      contacts: { create: mockContactsCreate },
    }));
    mockIsServiceAvailable.mockReturnValue(true);
    mockEnv.RESEND_API_KEY = "re_test_key";
    mockEnv.RESEND_AUDIENCE_ID = "aud_123";
  });

  it("warns and returns false without calling Resend when the API key is not configured", async () => {
    mockIsServiceAvailable.mockReturnValue(false);

    const result = await syncUserToResendAudience({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });

    expect(result).toBe(false);
    expect(mockContactsCreate).not.toHaveBeenCalled();
    expect(mockLogWarn).toHaveBeenCalled();
  });

  it("warns and returns false without calling Resend when RESEND_AUDIENCE_ID is not configured", async () => {
    mockEnv.RESEND_AUDIENCE_ID = undefined;

    const result = await syncUserToResendAudience({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });

    expect(result).toBe(false);
    expect(mockContactsCreate).not.toHaveBeenCalled();
    expect(mockLogWarn).toHaveBeenCalled();
  });

  it("adds the contact to the configured audience and returns true", async () => {
    mockContactsCreate.mockResolvedValue({
      data: { object: "contact", id: "contact_1" },
      error: null,
    });

    const result = await syncUserToResendAudience({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });

    expect(result).toBe(true);
    expect(mockResend).toHaveBeenCalledWith("re_test_key");
    expect(mockContactsCreate).toHaveBeenCalledWith({
      audienceId: "aud_123",
      email: "prof@university.edu",
      firstName: "Prof Joubin",
    });
  });

  it("omits firstName when the user has no name", async () => {
    mockContactsCreate.mockResolvedValue({
      data: { object: "contact", id: "contact_1" },
      error: null,
    });

    await syncUserToResendAudience({
      email: "prof@university.edu",
      name: null,
    });

    expect(mockContactsCreate).toHaveBeenCalledWith({
      audienceId: "aud_123",
      email: "prof@university.edu",
      firstName: undefined,
    });
  });

  it("returns false and logs the Resend error when Resend responds with an error", async () => {
    mockContactsCreate.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Invalid email" },
    });

    const result = await syncUserToResendAudience({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });

    expect(result).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      { name: "validation_error", message: "Invalid email" },
      "Failed to add contact to Resend audience",
      { email: "prof@university.edu" },
    );
  });

  it("returns false and logs when the request throws", async () => {
    mockContactsCreate.mockRejectedValue(new Error("network down"));

    const result = await syncUserToResendAudience({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });

    expect(result).toBe(false);
    expect(mockLogError).toHaveBeenCalled();
  });

  it("returns false and logs when the request exceeds the timeout", async () => {
    jest.useFakeTimers();
    try {
      mockContactsCreate.mockReturnValue(
        new Promise<CreateContactResponse>(() => {}),
      );

      const promise = syncUserToResendAudience({
        email: "prof@university.edu",
        name: "Prof Joubin",
      });
      await jest.advanceTimersByTimeAsync(10_000);

      await expect(promise).resolves.toBe(false);
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("timed out"),
        }),
        "Failed to add contact to Resend audience",
        { email: "prof@university.edu" },
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
