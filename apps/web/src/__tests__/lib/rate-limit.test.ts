import { jest, describe, it, expect } from "@jest/globals";
import type { Ratelimit } from "@upstash/ratelimit";

// Mock external dependencies
jest.mock("@upstash/ratelimit");
jest.mock("@upstash/redis");
jest.mock("@/lib/env", () => ({
  isServiceAvailable: jest.fn().mockReturnValue(false),
  env: {},
}));
jest.mock("@/lib/logger", () => ({
  logWarn: jest.fn(),
}));

// Dynamic import after mocks are set up
const { checkRateLimit } = await import("@/lib/rate-limit");

function mockLimiter(response: {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}): Ratelimit {
  return {
    limit: jest
      .fn<(id: string) => Promise<typeof response>>()
      .mockResolvedValue(response),
  } as unknown as Ratelimit;
}

describe("checkRateLimit", () => {
  it("returns success when limiter is null (Redis not configured)", async () => {
    const result = await checkRateLimit(null, "test-user");
    expect(result).toEqual({
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    });
  });

  it("calls limiter.limit with the identifier", async () => {
    const limiter = mockLimiter({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60000,
    });

    const result = await checkRateLimit(limiter, "test-user");

    expect(limiter.limit).toHaveBeenCalledWith("test-user");
    expect(result.success).toBe(true);
  });

  it("returns failure when rate limit is exceeded", async () => {
    const limiter = mockLimiter({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const result = await checkRateLimit(limiter, "test-user", {
      action: "login",
    });

    expect(limiter.limit).toHaveBeenCalledWith("test-user");
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
