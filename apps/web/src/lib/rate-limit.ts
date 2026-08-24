import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { isServiceAvailable, env } from "./env";
import { logWarn } from "./logger";
import {
  CRAWL_SOURCES_PER_HOUR,
  MANUAL_URLS_PER_HOUR,
  RECRAWLS_PER_HOUR,
} from "./constants/rate-limits";

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

// Global per-shareToken cap for public chat, keyed on the shareToken alone (no
// IP). The per-(IP, shareToken) limiter above can be defeated by a distributed
// caller rotating source IPs; this bounds total LLM spend attributable to a
// single shared link regardless of source IP. Set well above the per-IP limit
// so a legitimate multi-student classroom isn't throttled, but low enough that
// one token can't run up an unbounded bill.
export const publicChatGlobalRateLimit = createLimiter({
  window: [300, "1 m"],
  prefix: "@ratelimit/public-chat-global",
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

// Rate limiter for authenticated study-tool responses (quiz attempts, etc.)
// 60 per minute per user. Cheaper than chat (a DB write, no LLM), so a higher
// cap; a student answering/retaking several quizzes shouldn't be throttled.
export const studyResponseRateLimit = createLimiter({
  window: [60, "1 m"],
  prefix: "@ratelimit/study-response",
});

// Rate limiter for study-tool responses on public/shared links
// 30 per minute per (IP, shareToken). No LLM cost, so no global per-token cap
// is needed; this bounds write spam per source.
export const publicStudyResponseRateLimit = createLimiter({
  window: [30, "1 m"],
  prefix: "@ratelimit/study-response-public",
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

// Rate limiter for adding crawl sources
// 5 per hour per user (each triggers many page fetches + embeddings)
export const crawlSourceRateLimit = createLimiter({
  window: [CRAWL_SOURCES_PER_HOUR, "1 h"],
  prefix: "@ratelimit/crawl-source",
});

// Rate limiter for adding manual URLs
// 20 per hour per user
export const manualUrlRateLimit = createLimiter({
  window: [MANUAL_URLS_PER_HOUR, "1 h"],
  prefix: "@ratelimit/manual-url",
});

// Rate limiter for recrawl requests
// 5 per hour per user
export const recrawlRateLimit = createLimiter({
  window: [RECRAWLS_PER_HOUR, "1 h"],
  prefix: "@ratelimit/recrawl",
});

// Rate limiter for voice transcription (authenticated users)
// 10 transcriptions per 10 minutes per user. Each call can be up to a
// 3-minute clip, so the per-call cost is meaningfully higher than chat.
export const transcriptionRateLimit = createLimiter({
  window: [10, "10 m"],
  prefix: "@ratelimit/transcription",
});

// Rate limiter for voice transcription on public/shared links
// 5 per 10 minutes per IP+shareToken. Shared links have no userId,
// so abuse is bounded per (IP, chatbot) pair.
export const publicTranscriptionRateLimit = createLimiter({
  window: [5, "10 m"],
  prefix: "@ratelimit/transcription-public",
});

// Global per-shareToken cap for public voice transcription, keyed on the
// shareToken alone (no IP). The per-(IP, shareToken) limiter above can be
// defeated by rotating spoofed/rotating IPs; this bounds total Whisper
// spend attributable to a single shared link regardless of source IP.
// Set well above the per-IP limit so legitimate multi-user classrooms
// aren't throttled, but low enough that a single token can't run up an
// unbounded bill.
export const publicTranscriptionGlobalRateLimit = createLimiter({
  window: [20, "10 m"],
  prefix: "@ratelimit/transcription-public-global",
});

// Rate limiter for conversation search
// 20 searches per minute per user (each is an unindexed ILIKE scan)
export const conversationSearchRateLimit = createLimiter({
  window: [20, "1 m"],
  prefix: "@ratelimit/conversation-search",
});

/** Deny result used when a rate limiter is unavailable and we fail closed. */
function failClosedResult() {
  return { success: false, limit: 0, remaining: 0, reset: Date.now() + 60000 };
}

/**
 * Check rate limit and log if exceeded.
 *
 * When the limiter is null (Redis not configured) or throws at runtime
 * (partition/timeout), behavior depends on `failOpen`:
 * - `failOpen: true` (default): allow the request through (best-effort limiting
 *   for public/non-critical endpoints).
 * - `failOpen: false`: deny the request. `requireRateLimit` passes this so a
 *   security-critical endpoint never becomes a free proxy during a Redis
 *   outage -- an error must NOT fall through to the allow path.
 */
export async function checkRateLimit(
  ratelimiter: Ratelimit | null,
  identifier: string,
  context?: Record<string, unknown>,
  failOpen: boolean = true,
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  if (!ratelimiter) {
    return failOpen
      ? { success: true, limit: 0, remaining: 0, reset: 0 }
      : failClosedResult();
  }

  let result: Awaited<ReturnType<Ratelimit["limit"]>>;
  try {
    result = await ratelimiter.limit(identifier);
  } catch (err) {
    logWarn(
      failOpen
        ? "Rate limiter check failed; allowing request"
        : "Rate limiter check failed; denying request (fail closed)",
      {
        ...context,
        identifier,
        error: err instanceof Error ? err.message : String(err),
      },
    );
    return failOpen
      ? { success: true, limit: 0, remaining: 0, reset: 0 }
      : failClosedResult();
  }
  const { success, limit, remaining, reset } = result;

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

/**
 * Require rate limit for security-critical operations (password verification, account deletion).
 * Unlike checkRateLimit, this DENIES requests when Redis is unavailable rather than allowing them.
 */
export async function requireRateLimit(
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
    logWarn(
      "Rate limiter unavailable for security-critical operation",
      context,
    );
    return failClosedResult();
  }

  // Fail closed: a configured limiter that errors at runtime must deny, not
  // inherit checkRateLimit's best-effort allow-on-error.
  return checkRateLimit(ratelimiter, identifier, context, /* failOpen */ false);
}
