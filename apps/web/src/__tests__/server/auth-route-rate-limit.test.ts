/**
 * @jest-environment node
 *
 * The login and registration limiters in POST /api/auth/[...all] must key
 * on the trusted client IP (x-real-ip, else the rightmost, edge-appended
 * X-Forwarded-For hop). Keying on the leftmost hop let a caller dodge the
 * limit by rotating a header they fully control.
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

type LimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};
type Limiter = { limit: (identifier: string) => Promise<LimitResult> };

const mockCheckRateLimit =
  jest.fn<
    (
      limiter: Limiter | null,
      identifier: string,
      context?: Record<string, unknown>,
    ) => Promise<LimitResult>
  >();
const mockAuthPost = jest.fn<(request: unknown) => Promise<Response>>();

// Named limiter stand-ins so tests can tell which endpoint was checked.
const loginRateLimit = { name: "login" };
const registrationRateLimit = { name: "registration" };

jest.unstable_mockModule("@/server/auth", () => ({ auth: {} }));

jest.unstable_mockModule("better-auth/next-js", () => ({
  toNextJsHandler: () => ({
    GET: jest.fn(),
    POST: (request: unknown) => mockAuthPost(request),
  }),
}));

// The real module pulls in @upstash/redis; mirror only what the route uses.
jest.unstable_mockModule("@/server/rate-limit", () => ({
  loginRateLimit,
  registrationRateLimit,
  checkRateLimit: mockCheckRateLimit,
}));

const { POST } = await import("@/app/api/auth/[...all]/route");

function makeRequest(pathname: string, headers: Record<string, string>) {
  const lower = new Map(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    nextUrl: { pathname },
    headers: { get: (name: string) => lower.get(name.toLowerCase()) ?? null },
  } as unknown as Parameters<typeof POST>[0];
}

/** Fixed-window limiter fake: `max` hits per identifier, then deny. */
function inMemoryLimiter(max: number): Limiter {
  const hits = new Map<string, number>();
  return {
    limit: async (identifier) => {
      const count = (hits.get(identifier) ?? 0) + 1;
      hits.set(identifier, count);
      return {
        success: count <= max,
        limit: max,
        remaining: Math.max(0, max - count),
        reset: Date.now() + 15 * 60 * 1000,
      };
    },
  };
}

const SIGN_IN = "/api/auth/sign-in/email";
const SIGN_UP = "/api/auth/sign-up/email";

beforeEach(() => {
  mockAuthPost.mockResolvedValue(new Response("ok", { status: 200 }));
  mockCheckRateLimit.mockResolvedValue({
    success: true,
    limit: 5,
    remaining: 4,
    reset: Date.now() + 60_000,
  });
});

describe("auth route rate-limit keying", () => {
  it("keys sign-in on the rightmost X-Forwarded-For hop", async () => {
    await POST(makeRequest(SIGN_IN, { "x-forwarded-for": "1.1.1.1, 9.9.9.9" }));

    expect(mockCheckRateLimit).toHaveBeenCalledTimes(1);
    const [limiter, identifier, context] = mockCheckRateLimit.mock.calls[0]!;
    expect(limiter).toBe(loginRateLimit);
    expect(identifier).toBe("9.9.9.9");
    expect(context).toMatchObject({ ip: "9.9.9.9", endpoint: "login" });
  });

  it("prefers x-real-ip over X-Forwarded-For", async () => {
    await POST(
      makeRequest(SIGN_IN, {
        "x-forwarded-for": "1.1.1.1, 9.9.9.9",
        "x-real-ip": "8.8.8.8",
      }),
    );

    expect(mockCheckRateLimit.mock.calls[0]![1]).toBe("8.8.8.8");
  });

  it("keys sign-up on the trusted IP too", async () => {
    await POST(makeRequest(SIGN_UP, { "x-forwarded-for": "1.1.1.1, 9.9.9.9" }));

    const [limiter, identifier] = mockCheckRateLimit.mock.calls[0]!;
    expect(limiter).toBe(registrationRateLimit);
    expect(identifier).toBe("9.9.9.9");
  });

  it("puts sign-ins with rotated leftmost hops in one bucket and 429s the sixth", async () => {
    const limiter = inMemoryLimiter(5);
    mockCheckRateLimit.mockImplementation((_l, identifier) =>
      limiter.limit(identifier),
    );

    const statuses: number[] = [];
    for (let i = 1; i <= 6; i++) {
      const res = await POST(
        makeRequest(SIGN_IN, { "x-forwarded-for": `10.0.0.${i}, 9.9.9.9` }),
      );
      statuses.push(res.status);
    }

    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    expect(mockAuthPost).toHaveBeenCalledTimes(5);
    expect(new Set(mockCheckRateLimit.mock.calls.map((c) => c[1]))).toEqual(
      new Set(["9.9.9.9"]),
    );
  });

  it("keeps the 429 body and headers unchanged", async () => {
    const reset = Date.now() + 30_000;
    mockCheckRateLimit.mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset,
    });

    const res = await POST(makeRequest(SIGN_IN, { "x-real-ip": "8.8.8.8" }));

    expect(res.status).toBe(429);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(res.headers.get("X-RateLimit-Reset")).toBe(reset.toString());
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      error: "Too many login attempts",
      message: "Please try again later",
    });
    expect(typeof body.retryAfter).toBe("number");
    expect(mockAuthPost).not.toHaveBeenCalled();
  });

  it("does not rate-limit other auth endpoints", async () => {
    await POST(
      makeRequest("/api/auth/sign-out", { "x-forwarded-for": "9.9.9.9" }),
    );

    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockAuthPost).toHaveBeenCalledTimes(1);
  });
});
