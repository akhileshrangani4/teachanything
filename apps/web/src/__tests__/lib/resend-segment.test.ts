import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockEnv: { RESEND_API_KEY?: string; RESEND_SEGMENT_ID?: string } = {};
const mockLogWarn = jest.fn();
const mockLogError = jest.fn();

jest.unstable_mockModule("@/lib/env", () => ({ env: mockEnv }));
jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logWarn: mockLogWarn,
  logError: mockLogError,
}));

const { syncUserToResendSegment } = await import("@/server/resend-segment");

const mockFetch = jest.fn<typeof fetch>();

// Minimal Response stub — the helper only reads .ok, .status and .text().
function makeRes(status: number, body = ""): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as unknown as Response;
}

// Responses for the two calls the helper may make, dispatched by URL.
let addResponse: Response;
let createResponse: Response;

const addCalls = () =>
  mockFetch.mock.calls.filter(([url]) => String(url).includes("/segments/"));
const createCalls = () =>
  mockFetch.mock.calls.filter(
    ([url]) => String(url) === "https://api.resend.com/contacts",
  );

describe("syncUserToResendSegment", () => {
  beforeEach(() => {
    mockEnv.RESEND_API_KEY = "re_test_key";
    mockEnv.RESEND_SEGMENT_ID = "seg_123";
    addResponse = makeRes(201, JSON.stringify({ id: "c1" }));
    createResponse = makeRes(201, JSON.stringify({ id: "c1" }));
    global.fetch = mockFetch;
    mockFetch.mockImplementation((async (url: unknown) =>
      String(url).includes("/segments/")
        ? addResponse
        : createResponse) as unknown as typeof fetch);
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

  it("logs an error (not a silent warn) and returns false when RESEND_SEGMENT_ID is missing", async () => {
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

  it("adds an EXISTING contact to the segment and never re-creates it (preserves unsubscribed)", async () => {
    const result = await syncUserToResendSegment({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });
    expect(result).toBe(true);
    // add-to-segment hit with the encoded email + segment id
    expect(addCalls()).toHaveLength(1);
    expect(String(addCalls()[0][0])).toBe(
      "https://api.resend.com/contacts/prof%40university.edu/segments/seg_123",
    );
    expect((addCalls()[0][1] as RequestInit).method).toBe("POST");
    // crucially, NO POST /contacts (which would upsert and reset unsubscribed)
    expect(createCalls()).toHaveLength(0);
  });

  it("creates the contact only when it does not exist (add-to-segment 404)", async () => {
    addResponse = makeRes(
      404,
      JSON.stringify({ message: "Contact not found" }),
    );
    const result = await syncUserToResendSegment({
      email: "new@university.edu",
      name: "Prof Joubin",
    });
    expect(result).toBe(true);
    expect(createCalls()).toHaveLength(1);
    expect(
      JSON.parse((createCalls()[0][1] as RequestInit).body as string),
    ).toEqual({
      email: "new@university.edu",
      first_name: "Prof",
      last_name: "Joubin",
      segments: [{ id: "seg_123" }],
    });
  });

  it("splits a multi-part name on create", async () => {
    addResponse = makeRes(404, "not found");
    await syncUserToResendSegment({
      email: "new@university.edu",
      name: "Alexa Alice Joubin",
    });
    expect(
      JSON.parse((createCalls()[0][1] as RequestInit).body as string),
    ).toMatchObject({ first_name: "Alexa", last_name: "Alice Joubin" });
  });

  it("omits name fields on create when there is no name", async () => {
    addResponse = makeRes(404, "not found");
    await syncUserToResendSegment({ email: "new@university.edu", name: null });
    expect(
      JSON.parse((createCalls()[0][1] as RequestInit).body as string),
    ).toEqual({ email: "new@university.edu", segments: [{ id: "seg_123" }] });
  });

  it("treats an already-in-segment response (409) as success", async () => {
    addResponse = makeRes(409, "already in segment");
    const result = await syncUserToResendSegment({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });
    expect(result).toBe(true);
    expect(createCalls()).toHaveLength(0);
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it("returns false and logs when add-to-segment fails with a non-404 error", async () => {
    addResponse = makeRes(500, "server error");
    const result = await syncUserToResendSegment({
      email: "prof@university.edu",
      name: "Prof Joubin",
    });
    expect(result).toBe(false);
    expect(createCalls()).toHaveLength(0);
    expect(mockLogError).toHaveBeenCalled();
  });

  it("returns false and logs when the create (after 404) fails", async () => {
    addResponse = makeRes(404, "not found");
    createResponse = makeRes(422, JSON.stringify({ message: "Invalid email" }));
    const result = await syncUserToResendSegment({
      email: "bad@university.edu",
      name: "Prof Joubin",
    });
    expect(result).toBe(false);
    expect(mockLogError).toHaveBeenCalled();
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
