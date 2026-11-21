import { logError } from "@/lib/logger";

/** Retry schedule (ms). See the retry rationale on `postWithPersistRetry`. */
export const PERSIST_RETRY_DELAYS_MS = [1500, 3000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST a small JSON write that refers to the assistant turn the student is
 * looking at, retrying the failures expected in normal use. Never throws: a
 * final failure is logged with `failureMessage` and reported as `false`, so
 * callers can stay fire-and-forget or roll back optimistic UI.
 *
 * Bounded retry, because two transient failures are expected:
 * - 404: the UI shows the turn while the stream is still open, but the server
 *   can only find the message after the assistant turn persists in onFinish --
 *   a fast student can beat that commit. A short backoff lets the insert land.
 * - network errors / 5xx: ordinary blips; the payloads are tiny and the writes
 *   are idempotent server-side.
 * 4xx other than 404 (validation, rate limit) are NOT retried.
 */
export async function postWithPersistRetry(
  endpoint: string,
  body: unknown,
  failureMessage: string,
): Promise<boolean> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return true;
      const retryable = res.status === 404 || res.status >= 500;
      if (!retryable || attempt >= PERSIST_RETRY_DELAYS_MS.length) {
        logError(new Error(`${endpoint} ${res.status}`), failureMessage);
        return false;
      }
    } catch (err) {
      // Network-level failure: retryable.
      if (attempt >= PERSIST_RETRY_DELAYS_MS.length) {
        logError(err, failureMessage);
        return false;
      }
    }
    await sleep(PERSIST_RETRY_DELAYS_MS[attempt] ?? 3000);
  }
}
