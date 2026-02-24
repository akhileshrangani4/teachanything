import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { isServiceAvailable, env } from "./env";
import { logWarn } from "./logger";

// Conditionally create Redis client and rate limiters
const redis = isServiceAvailable("redis")
  ? new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

function createLimiter(config: {
  window: [number, string];
  prefix: string;
}): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      config.window[0],
      config.window[1] as Parameters<typeof Ratelimit.slidingWindow>[1],
    ),
    analytics: true,
    prefix: config.prefix,
  });
}

// Rate limiter for public chat endpoints
// 10 requests per 10 seconds per IP
export const publicChatRateLimit = createLimiter({
  window: [10, "10 s"],
  prefix: "@ratelimit/public-chat",
});

// Rate limiter for file uploads
// 20 uploads per minute per user
export const fileUploadRateLimit = createLimiter({
  window: [20, "1 m"],
  prefix: "@ratelimit/file-upload",
});

// Rate limiter for chatbot creation
// 10 chatbots per hour per user
export const chatbotCreationRateLimit = createLimiter({
  window: [10, "1 h"],
  prefix: "@ratelimit/chatbot-creation",
});

// Rate limiter for password updates
// 5 attempts per hour per user (prevents brute force)
export const passwordUpdateRateLimit = createLimiter({
  window: [5, "1 h"],
  prefix: "@ratelimit/password-update",
});

// Rate limiter for login attempts
// 5 attempts per 15 minutes per IP (prevents brute force)
export const loginRateLimit = createLimiter({
  window: [5, "15 m"],
  prefix: "@ratelimit/login",
});

// Rate limiter for registration attempts
// 3 registrations per hour per IP (prevents spam accounts)
export const registrationRateLimit = createLimiter({
  window: [3, "1 h"],
  prefix: "@ratelimit/registration",
});

// Rate limiter for authenticated chat messages
// 30 messages per minute per user (prevents abuse)
export const authenticatedChatRateLimit = createLimiter({
  window: [30, "1 m"],
  prefix: "@ratelimit/authenticated-chat",
});

// Rate limiter for password reset requests
// 2 requests per 2 minutes per email (prevents email bombing)
export const passwordResetRateLimit = createLimiter({
  window: [2, "120 s"],
  prefix: "@ratelimit/password-reset",
});

// Rate limiter for admin actions
// 20 actions per minute per admin (prevents abuse)
export const adminActionRateLimit = createLimiter({
  window: [20, "1 m"],
  prefix: "@ratelimit/admin-action",
});

// Rate limiter for file downloads
// 30 downloads per minute per user (prevents abuse)
export const downloadRateLimit = createLimiter({
  window: [30, "1 m"],
  prefix: "@ratelimit/download",
});

/**
 * Check rate limit and log if exceeded.
 * When limiter is null (Redis not configured), returns success as a noop.
 */
export async function checkRateLimit(
  ratelimiter: Ratelimit | null,
  identifier: string,
  context?: Record<string, unknown>,
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  if (!ratelimiter) {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  const { success, limit, remaining, reset } =
    await ratelimiter.limit(identifier);

  if (!success) {
    logWarn("Rate limit exceeded", {
      ...context,
      identifier,
      limit,
      remaining,
      reset,
    });
  }

  return { success, limit, remaining, reset };
}
