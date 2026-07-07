/**
 * @jest-environment node
 *
 * Integration tests for the POST /api/transcribe Route Handler. Every
 * external boundary (auth, db, rate limiters, env, provider call) is
 * mocked; these tests cover the handler's own wiring: auth resolution,
 * the approval gate, rate-limit ordering and fail-closed behavior, the
 * post-call duration gate, DB-error -> JSON contract, and the
 * 401/403/404/413/429/500 branches that the helper-only tests can't reach.
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

// ---- Mock fns (referenced inside factories, so declare first) ----
const mockGetSession =
  jest.fn<
    (args: unknown) => Promise<{ user: Record<string, unknown> } | null>
  >();
const mockTranscribeAudio = jest.fn<
  () => Promise<{
    text: string;
    language: string | null;
    durationSeconds: number | null;
  }>
>();
const mockFindOwnedChatbotId =
  jest.fn<() => Promise<{ id: string } | undefined>>();

// Rate limiters: each `.limit()` resolves a success/reset shape.
const mockAuthedLimit = jest.fn<() => Promise<{ success: boolean }>>();
const mockPublicLimit = jest.fn<() => Promise<{ success: boolean }>>();
const mockGlobalLimit = jest.fn<() => Promise<{ success: boolean }>>();

// db.select()...limit() chain (shareToken lookup) and db.insert() (analytics).
const mockShareLookup = jest.fn<() => Promise<Array<{ id: string }>>>();
const mockAnalyticsInsert = jest.fn<() => Promise<void>>();

jest.unstable_mockModule("@/lib/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}));

jest.unstable_mockModule("@teachanything/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => mockShareLookup(),
        }),
      }),
    }),
    insert: () => ({
      values: (...args: unknown[]) => mockAnalyticsInsert(...(args as [])),
    }),
  },
}));

jest.unstable_mockModule("@teachanything/db/schema", () => ({
  chatbots: { id: "id", shareToken: "shareToken", sharingEnabled: "enabled" },
  analytics: {},
}));

jest.unstable_mockModule("drizzle-orm", () => ({
  eq: (...a: unknown[]) => a,
  and: (...a: unknown[]) => a,
}));

jest.unstable_mockModule("@/server/queries/chatbot", () => ({
  findOwnedChatbotId: mockFindOwnedChatbotId,
}));

// Self-contained rate-limit mock. We intentionally do NOT import the real
// module (it pulls in @upstash/redis + ratelimit, which is heavy enough to
// OOM the jsdom worker when combined with the route's graph). The fail-open
// (checkRateLimit) vs fail-closed (requireRateLimit) null-handling is unit-
// tested directly in __tests__/lib/rate-limit.test.ts; here we mirror just
// enough to exercise the route's wiring.
type LimitResult = { success: boolean; reset?: number };
async function fakeCheck(
  limiter: { limit: () => Promise<LimitResult> } | null,
): Promise<{ success: boolean; reset: number }> {
  if (!limiter) return { success: true, limit: 0, remaining: 0, reset: 0 };
  const r = await limiter.limit();
  return { ...r, reset: r.reset ?? 0 } as { success: boolean; reset: number };
}
async function fakeRequire(
  limiter: { limit: () => Promise<LimitResult> } | null,
): Promise<{ success: boolean; reset: number }> {
  if (!limiter) return { success: false, reset: Date.now() + 60000 };
  const r = await limiter.limit();
  return { ...r, reset: r.reset ?? 0 } as { success: boolean; reset: number };
}
jest.unstable_mockModule("@/lib/rate-limit", () => ({
  checkRateLimit: fakeCheck,
  requireRateLimit: fakeRequire,
  transcriptionRateLimit: { limit: mockAuthedLimit },
  publicTranscriptionRateLimit: { limit: mockPublicLimit },
  publicTranscriptionGlobalRateLimit: { limit: mockGlobalLimit },
}));

jest.unstable_mockModule("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_VOICE_INPUT_ENABLED: "true",
    OPENAI_API_KEY: "sk-test",
  },
  isServiceAvailable: () => false,
}));

jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  logDebug: jest.fn(),
}));

// Real validation + helpers are pure; let them run unmocked. But the AI
// package pulls in heavy deps, so stub transcribeAudio + TranscriptionError.
class FakeTranscriptionError extends Error {
  reason: string;
  constructor(message: string, reason: string) {
    super(message);
    this.name = "TranscriptionError";
    this.reason = reason;
  }
}
jest.unstable_mockModule("@teachanything/ai", () => ({
  transcribeAudio: mockTranscribeAudio,
  TranscriptionError: FakeTranscriptionError,
}));

const { POST } = await import("@/app/api/transcribe/route");

// ---- Request helper ----
function makeRequest(opts: {
  url?: string;
  headers?: Record<string, string>;
  audio?: Blob | null;
  chatbotId?: string;
}) {
  const headers = new Map<string, string>();
  for (const [k, v] of Object.entries(opts.headers ?? {})) {
    headers.set(k.toLowerCase(), v);
  }
  const form = new FormData();
  if (opts.audio !== null) {
    const blob =
      opts.audio ?? new Blob([new Uint8Array(2048)], { type: "audio/webm" });
    form.append("audio", blob, "recording.webm");
  }
  if (opts.chatbotId) form.append("chatbotId", opts.chatbotId);

  return {
    url: opts.url ?? "https://app.test/api/transcribe",
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    formData: async () => form,
  } as unknown as Parameters<typeof POST>[0];
}

function approvedUser(overrides: Record<string, unknown> = {}) {
  return { id: "user_1", role: "user", status: "approved", ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue(null);
  mockTranscribeAudio.mockResolvedValue({
    text: "hello world",
    language: "english",
    durationSeconds: 3,
  });
  mockFindOwnedChatbotId.mockResolvedValue(undefined);
  mockAuthedLimit.mockResolvedValue({ success: true });
  mockPublicLimit.mockResolvedValue({ success: true });
  mockGlobalLimit.mockResolvedValue({ success: true });
  mockShareLookup.mockResolvedValue([{ id: "cb_1" }]);
  mockAnalyticsInsert.mockResolvedValue(undefined);
});

describe("POST /api/transcribe — auth resolution", () => {
  it("401 when no session and no shareToken", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("unauthorized");
  });

  it("403 for an authenticated but unapproved user", async () => {
    mockGetSession.mockResolvedValue({
      user: approvedUser({ status: "pending" }),
    });
    const res = await POST(makeRequest({ headers: { cookie: "session=x" } }));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("unauthorized");
    // Must not reach the provider.
    expect(mockTranscribeAudio).not.toHaveBeenCalled();
  });

  it("allows an admin even if status is not approved", async () => {
    mockGetSession.mockResolvedValue({
      user: approvedUser({ role: "admin", status: "pending" }),
    });
    const res = await POST(makeRequest({ headers: { cookie: "session=x" } }));
    expect(res.status).toBe(200);
    expect(mockTranscribeAudio).toHaveBeenCalledTimes(1);
  });

  it("200 happy path for an approved user", async () => {
    mockGetSession.mockResolvedValue({ user: approvedUser() });
    const res = await POST(makeRequest({ headers: { cookie: "session=x" } }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { text: string };
    expect(body.text).toBe("hello world");
    expect(mockAuthedLimit).toHaveBeenCalledTimes(1);
    // Authed path must not touch the public limiter or shareToken lookup.
    expect(mockPublicLimit).not.toHaveBeenCalled();
    expect(mockShareLookup).not.toHaveBeenCalled();
  });

  it("session wins over shareToken when both present", async () => {
    mockGetSession.mockResolvedValue({ user: approvedUser() });
    const res = await POST(
      makeRequest({
        url: "https://app.test/api/transcribe?shareToken=tok",
        headers: { cookie: "session=x" },
      }),
    );
    expect(res.status).toBe(200);
    expect(mockAuthedLimit).toHaveBeenCalledTimes(1);
    expect(mockPublicLimit).not.toHaveBeenCalled();
  });
});

describe("POST /api/transcribe — shared/public surface", () => {
  function sharedReq(extra: Record<string, string> = {}) {
    return makeRequest({
      url: "https://app.test/api/transcribe?shareToken=tok",
      headers: { "x-real-ip": "203.0.113.9", ...extra },
    });
  }

  it("200 happy path resolves chatbot from shareToken", async () => {
    const res = await POST(sharedReq());
    expect(res.status).toBe(200);
    expect(mockPublicLimit).toHaveBeenCalledTimes(1);
    expect(mockGlobalLimit).toHaveBeenCalledTimes(1);
    expect(mockShareLookup).toHaveBeenCalledTimes(1);
    // Analytics attributed to the resolved chatbot.
    expect(mockAnalyticsInsert).toHaveBeenCalledTimes(1);
  });

  it("404 when shareToken does not resolve to an enabled chatbot", async () => {
    mockShareLookup.mockResolvedValue([]);
    const res = await POST(sharedReq());
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("share_not_found");
    expect(mockTranscribeAudio).not.toHaveBeenCalled();
  });

  it("rate-limits BEFORE the shareToken DB lookup", async () => {
    mockPublicLimit.mockResolvedValue({ success: false, reset: Date.now() });
    const res = await POST(sharedReq());
    expect(res.status).toBe(429);
    // The expensive lookup must be gated by the limiter.
    expect(mockShareLookup).not.toHaveBeenCalled();
  });

  it("429 when the per-shareToken global cap is exceeded", async () => {
    mockGlobalLimit.mockResolvedValue({ success: false, reset: Date.now() });
    const res = await POST(sharedReq());
    expect(res.status).toBe(429);
    // Per-IP limiter passed; the global cap is what tripped.
    expect(mockPublicLimit).toHaveBeenCalledTimes(1);
    expect(mockTranscribeAudio).not.toHaveBeenCalled();
  });

  it("500 JSON (not HTML) when the shareToken lookup throws", async () => {
    mockShareLookup.mockRejectedValue(new Error("pool exhausted"));
    const res = await POST(sharedReq());
    expect(res.status).toBe(500);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("internal_error");
  });
});

describe("POST /api/transcribe — validation & provider", () => {
  function authedReq(audio?: Blob | null, chatbotId?: string) {
    return makeRequest({
      headers: { cookie: "session=x" },
      audio,
      chatbotId,
    });
  }

  beforeEach(() => {
    mockGetSession.mockResolvedValue({ user: approvedUser() });
  });

  it("400 when no audio blob is present", async () => {
    const res = await POST(authedReq(null));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("audio_invalid");
  });

  it("413 when the audio blob exceeds MAX_BYTES", async () => {
    // Stub the reported size rather than allocating 7MB — validateAudioBlob
    // only reads `.size` and `.type`, and a real large buffer under v8
    // coverage is a needless memory hog.
    const big = new Blob([new Uint8Array(16)], { type: "audio/webm" });
    Object.defineProperty(big, "size", { value: 7 * 1024 * 1024 });
    const res = await POST(authedReq(big));
    expect(res.status).toBe(413);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("audio_too_large");
  });

  it("400 audio_duration_exceeded when Whisper reports over the cap", async () => {
    mockTranscribeAudio.mockResolvedValue({
      text: "long one",
      language: "english",
      durationSeconds: 999,
    });
    const res = await POST(authedReq());
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("audio_duration_exceeded");
  });

  it("maps a provider timeout to 504/provider_timeout", async () => {
    mockTranscribeAudio.mockRejectedValue(
      new FakeTranscriptionError("t", "timeout"),
    );
    const res = await POST(authedReq());
    expect(res.status).toBe(504);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("provider_timeout");
  });

  // chatbotId must be a real UUID now that the route validates the shape
  // before the ownership lookup (chatbots.id is a Postgres uuid column).
  const OWNED_CHATBOT_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";

  it("500 JSON when ownership lookup throws on the authed path", async () => {
    mockFindOwnedChatbotId.mockRejectedValue(new Error("db down"));
    const res = await POST(authedReq(undefined, OWNED_CHATBOT_ID));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("internal_error");
  });

  it("still succeeds (200) when analytics insert fails", async () => {
    mockFindOwnedChatbotId.mockResolvedValue({ id: OWNED_CHATBOT_ID });
    mockAnalyticsInsert.mockRejectedValue(new Error("insert failed"));
    const res = await POST(authedReq(undefined, OWNED_CHATBOT_ID));
    expect(res.status).toBe(200);
  });

  it("skips attribution (200, no lookup) for a non-UUID chatbotId", async () => {
    // A malformed client-supplied id must not reach the uuid-typed DB
    // query (Postgres would reject the cast and 500 the whole request);
    // it's treated like an unowned id: transcription succeeds unattributed.
    const res = await POST(authedReq(undefined, "not-a-uuid"));
    expect(res.status).toBe(200);
    expect(mockFindOwnedChatbotId).not.toHaveBeenCalled();
    expect(mockAnalyticsInsert).not.toHaveBeenCalled();
  });
});
