import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "./env";
import { logWarn } from "./logger";

// Create Redis client
const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

// Rate limiter for public chat endpoints
// 10 requests per 10 seconds per IP
export const publicChatRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  analytics: true,
  prefix: "@ratelimit/public-chat",
});

// Rate limiter for file uploads
// 20 uploads per minute per user
export const fileUploadRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  analytics: true,
  prefix: "@ratelimit/file-upload",
});

// Rate limiter for chatbot creation
// 10 chatbots per hour per user
export const chatbotCreationRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  analytics: true,
  prefix: "@ratelimit/chatbot-creation",
});

// Rate limiter for password updates
// 5 attempts per hour per user (prevents brute force)
export const passwordUpdateRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  analytics: true,
  prefix: "@ratelimit/password-update",
});

// Rate limiter for login attempts
// 5 attempts per 15 minutes per IP (prevents brute force)
export const loginRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  analytics: true,
  prefix: "@ratelimit/login",
});

// Rate limiter for registration attempts
// 3 registrations per hour per IP (prevents spam accounts)
export const registrationRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "1 h"),
  analytics: true,
  prefix: "@ratelimit/registration",
});

// Rate limiter for authenticated chat messages
// 30 messages per minute per user (prevents abuse)
export const authenticatedChatRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  analytics: true,
  prefix: "@ratelimit/authenticated-chat",
});

// Rate limiter for password reset requests
// 2 requests per 2 minutes per email (prevents email bombing)
export const passwordResetRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(2, "120 s"),
  analytics: true,
  prefix: "@ratelimit/password-reset",
});

// Rate limiter for admin actions
// 20 actions per minute per admin (prevents abuse)
export const adminActionRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  analytics: true,
  prefix: "@ratelimit/admin-action",
});

/**
 * Check rate limit and log if exceeded
 */
export async function checkRateLimit(
  ratelimiter: Ratelimit,
  identifier: string,
  context?: Record<string, unknown>,
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
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
