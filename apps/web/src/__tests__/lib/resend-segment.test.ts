import { jest, describe, it, expect, beforeEach } from "@jest/globals";

type CreateContactPayload = {
  email: string;
  firstName?: string;
  lastName?: string;
  segments?: { id: string }[];
};

type CreateContactResult = {
  data: { id: string } | null;
  error: { statusCode: number | null; name: string; message: string } | null;
};

// Mock external dependencies before importing the module under test.
// Mocks are held in test-scope variables (closed over by the factories);
// implementations are (re)established in beforeEach because jest.config
// sets resetMocks: true.
const mockContactsCreate =
  jest.fn<
    (
      payload: CreateContactPayload,
      options?: unknown,
    ) => Promise<CreateContactResult>
  >();
const mockResend = jest.fn();
const mockEnv: { RESEND_API_KEY?: string; RESEND_SEGMENT_ID?: string } = {};
const mockLogWarn = jest.fn();
const mockLogError = jest.fn();

jest.unstable_mockModule("resend", () => ({ Resend: mockResend }));

jest.unstable_mockModule("@/lib/env", () => ({
  env: mockEnv,
}));

jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logWarn: mockLogWarn,
  logError: mockLogError,
}));

// Dynamic import after mocks are set up
const { syncUserToResendSegment } = await import("@/lib/resend-segment");

describe("syncUserToResendSegment", () => {
  beforeEach(() => {
    mockResend.mockImplementation(() => ({
      contacts: { create: mockContactsCreate },
    }));
    mockContactsCreate.mockResolvedValue({
      data: { id: "contact_1" },
      error: null,
    });
    mockEnv.RESEND_API_KEY = "re_test_key";
    mockEnv.RESEND_SEGMENT_ID = "seg_123";
  });

  it("warns and returns false without calling Resend when the API key is not configured", async () => {
    mockEnv.RESEND_API_KEY = undefined;

    const result = await syncUserToResendSegment({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });

    expect(result).toBe(false);
    expect(mockContactsCreate).not.toHaveBeenCalled();
    expect(mockLogWarn).toHaveBeenCalled();
  });

  it("logs an error (not a silent warn) and returns false when the API key is set but RESEND_SEGMENT_ID is missing", async () => {
    mockEnv.RESEND_SEGMENT_ID = undefined;

    const result = await syncUserToResendSegment({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });

    expect(result).toBe(false);
    expect(mockContactsCreate).not.toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("RESEND_SEGMENT_ID"),
      }),
      expect.stringContaining("RESEND_SEGMENT_ID is missing"),
      { email: "prof@university.edu" },
    );
  });

  it("creates a global contact in the segment with the split name and returns true", async () => {
    const result = await syncUserToResendSegment({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });

    expect(result).toBe(true);
    expect(mockResend).toHaveBeenCalledWith("re_test_key");
    expect(mockContactsCreate).toHaveBeenCalledWith(
      {
        email: "prof@university.edu",
        firstName: "Prof",
        lastName: "Joubin",
        segments: [{ id: "seg_123" }],
      },
      // the abort signal that bounds the request
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("splits a multi-part name: first token is firstName, the rest is lastName", async () => {
    await syncUserToResendSegment({
      email: "prof@university.edu",
      name: "Alexa Alice Joubin",
    });

    expect(mockContactsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Alexa",
        lastName: "Alice Joubin",
      }),
      expect.anything(),
    );
  });

  it("omits both name fields when the user has no name", async () => {
    await syncUserToResendSegment({
      email: "prof@university.edu",
      name: null,
    });

    expect(mockContactsCreate).toHaveBeenCalledWith(
      {
        email: "prof@university.edu",
        firstName: undefined,
        lastName: undefined,
        segments: [{ id: "seg_123" }],
      },
      expect.anything(),
    );
  });

  it("treats an already-existing contact (409) as success", async () => {
    mockContactsCreate.mockResolvedValue({
      data: null,
      error: {
        statusCode: 409,
        name: "invalid_parameter",
        message: "Contact already exists",
      },
    });

    const result = await syncUserToResendSegment({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });

    expect(result).toBe(true);
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it("returns false and logs when Resend responds with an error", async () => {
    mockContactsCreate.mockResolvedValue({
      data: null,
      error: {
        statusCode: 422,
        name: "validation_error",
        message: "Invalid email",
      },
    });

    const result = await syncUserToResendSegment({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });

    expect(result).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid email" }),
      "Failed to add contact to Resend segment",
      { email: "prof@university.edu" },
    );
  });

  it("returns false and logs when the request throws (network error / timeout abort)", async () => {
    mockContactsCreate.mockRejectedValue(
      new Error("The operation was aborted"),
    );

    const result = await syncUserToResendSegment({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });

    expect(result).toBe(false);
    expect(mockLogError).toHaveBeenCalled();
  });
});
