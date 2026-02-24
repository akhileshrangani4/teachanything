import { jest, describe, it, expect } from "@jest/globals";

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
    const mockLimit = jest.fn().mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60000,
    } as never);

    const mockLimiter = { limit: mockLimit };

    const result = await checkRateLimit(
      mockLimiter as unknown as Parameters<typeof checkRateLimit>[0],
      "test-user",
    );

    expect(mockLimit).toHaveBeenCalledWith("test-user");
    expect(result.success).toBe(true);
  });

  it("returns failure when rate limit is exceeded", async () => {
    const mockLimit = jest.fn().mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 60000,
    } as never);

    const mockLimiter = { limit: mockLimit };

    const result = await checkRateLimit(
      mockLimiter as unknown as Parameters<typeof checkRateLimit>[0],
      "test-user",
      {
        action: "login",
      },
    );

    expect(mockLimit).toHaveBeenCalledWith("test-user");
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
