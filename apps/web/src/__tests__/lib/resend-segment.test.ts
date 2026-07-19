import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

// Mock external dependencies before importing the module under test.
// Mocks are held in test-scope variables (closed over by the factories);
// implementations are (re)established in beforeEach because jest.config
// sets resetMocks: true.
const mockEnv: { RESEND_API_KEY?: string; RESEND_SEGMENT_ID?: string } = {};
const mockLogWarn = jest.fn();
const mockLogError = jest.fn();

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

const mockFetch = jest.fn<typeof fetch>();

// Minimal Response stub — the helper only reads .ok, .status, and .text(),
// and the global Response constructor isn't available in this test env.
function makeRes(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as unknown as Response;
}

function okResponse() {
  return makeRes(201, JSON.stringify({ object: "contact", id: "contact_1" }));
}

describe("syncUserToResendSegment", () => {
  beforeEach(() => {
    mockEnv.RESEND_API_KEY = "re_test_key";
    mockEnv.RESEND_SEGMENT_ID = "seg_123";
    global.fetch = mockFetch;
    mockFetch.mockResolvedValue(okResponse());
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it("warns and returns false without calling Resend when the API key is not configured", async () => {
    mockEnv.RESEND_API_KEY = undefined;

    const result = await syncUserToResendSegment({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockLogWarn).toHaveBeenCalled();
  });

  it("logs an error (not a silent warn) and returns false when the API key is set but RESEND_SEGMENT_ID is missing", async () => {
    mockEnv.RESEND_SEGMENT_ID = undefined;

    const result = await syncUserToResendSegment({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("RESEND_SEGMENT_ID"),
      }),
      expect.stringContaining("RESEND_SEGMENT_ID is missing"),
      { email: "prof@university.edu" },
    );
  });

  it("POSTs to /contacts with the segment and split name and returns true", async () => {
    const result = await syncUserToResendSegment({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/contacts");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer re_test_key",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      email: "prof@university.edu",
      first_name: "Prof",
      last_name: "Joubin",
      segments: ["seg_123"],
    });
  });

  it("splits a multi-part name: first token is first_name, the rest is last_name", async () => {
    await syncUserToResendSegment({
      email: "prof@university.edu",
      name: "Alexa Alice Joubin",
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      first_name: "Alexa",
      last_name: "Alice Joubin",
    });
  });

  it("omits both name fields when the user has no name", async () => {
    await syncUserToResendSegment({
      email: "prof@university.edu",
      name: null,
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      email: "prof@university.edu",
      segments: ["seg_123"],
    });
  });

  it("treats an already-existing contact (409) as success", async () => {
    mockFetch.mockResolvedValue(
      makeRes(409, JSON.stringify({ message: "Contact already exists" })),
    );

    const result = await syncUserToResendSegment({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });

    expect(result).toBe(true);
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it("returns false and logs when Resend responds with an error status", async () => {
    mockFetch.mockResolvedValue(
      makeRes(422, JSON.stringify({ message: "Invalid email" })),
    );

    const result = await syncUserToResendSegment({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });

    expect(result).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("422"),
      }),
      "Failed to add contact to Resend segment",
      { email: "prof@university.edu" },
    );
  });

  it("returns false and logs when the request throws (network error / timeout abort)", async () => {
    mockFetch.mockRejectedValue(new Error("The operation was aborted"));

    const result = await syncUserToResendSegment({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });

    expect(result).toBe(false);
    expect(mockLogError).toHaveBeenCalled();
  });
});
