/**
 * Hourly caps for web-source additions.
 *
 * These live in a client-safe module (no redis/env imports) so the dashboard
 * copy, the tRPC error messages, and the limiter windows in
 * `lib/rate-limit.ts` all read the same numbers. Keep them in sync by
 * importing from here, never by re-typing the literal.
 */
export const CRAWL_SOURCES_PER_HOUR = 5;
export const MANUAL_URLS_PER_HOUR = 20;
export const RECRAWLS_PER_HOUR = 5;

/**
 * Human-readable wait until a sliding window frees up. `reset` is the epoch-ms
 * timestamp Upstash returns with a denied request. Clamped to at least one
 * minute so a sub-minute remainder never renders "in 0 minutes".
 */
export function formatRetryAfter(reset: number, now: number = Date.now()) {
  const minutes = Math.max(1, Math.ceil((reset - now) / 60_000));
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}
