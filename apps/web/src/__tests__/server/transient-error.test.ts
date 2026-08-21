import { describe, it, expect } from "@jest/globals";
import {
  isTransientError,
  isPermanentProviderError,
} from "@teachanything/ai/error-utils";

/**
 * RAG resilience tests.
 *
 * Tests the isTransientError function exported from openrouter-client.ts
 * which drives the retry-widening logic for embedding requests.
 *
 * The buildRAGContext integration tests are skipped in CI due to a jest ESM
 * limitation: the transitive uuid module uses named exports that fail during
 * module linking. The buildRAGContext behavior is covered by manual testing
 * against the local database.
 */

// ── Test Suite: isTransientError ────────────────────────────────────────────
describe("isTransientError", () => {
  it("matches 429 rate limit error", () => {
    expect(isTransientError("Rate limit exceeded")).toBe(true);
    expect(isTransientError("rate_limit: too many requests")).toBe(true);
    expect(isTransientError("API error: 429")).toBe(true);
  });

  it("matches 500 Internal Server Error", () => {
    expect(isTransientError("API error: 500")).toBe(true);
    expect(isTransientError("Internal Server Error")).toBe(true);
  });

  it("matches 502 Bad Gateway", () => {
    expect(isTransientError("API error: 502")).toBe(true);
    expect(isTransientError("Bad Gateway")).toBe(true);
  });

  it("matches 503 Service Unavailable", () => {
    expect(isTransientError("API error: 503")).toBe(true);
    expect(isTransientError("Service Unavailable")).toBe(true);
  });

  it("does NOT match 401 Unauthorized", () => {
    expect(isTransientError("API error: 401 Unauthorized")).toBe(false);
  });

  it("does NOT match 400 Bad Request", () => {
    expect(isTransientError("API error: 400 Bad Request")).toBe(false);
  });

  it("does NOT match 403 Forbidden", () => {
    expect(isTransientError("API error: 403 Forbidden")).toBe(false);
  });

  it("does NOT match generic errors", () => {
    expect(isTransientError("Network error")).toBe(false);
    expect(isTransientError("Invalid API key")).toBe(false);
  });
});

/**
 * The case that motivated splitting these apart: OpenAI returns an exhausted
 * prepaid balance as a 429, so the bare status test treated a permanent billing
 * condition as backpressure and retried it with backoff on every embedding call.
 *
 * The two VERIFIED strings below are what the AI SDK actually puts in
 * `error.message` (it copies OpenAI's `error.message` verbatim; the `type` and
 * `code` stay in `responseBody`, which this function never sees). Captured live
 * against the real API, not paraphrased. Do not "tidy" them.
 */
describe("isPermanentProviderError", () => {
  // Verified live, 429, while the account balance was empty.
  const QUOTA_EXHAUSTED =
    "You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.";
  // Verified live, 401, with a deliberately bad key.
  const BAD_KEY =
    "Incorrect API key provided: sk-proj-****************************0000. You can find your API key at https://platform.openai.com/account/api-keys.";

  it.each([
    ["verified quota-exhausted message", QUOTA_EXHAUSTED],
    ["verified bad-key message", BAD_KEY],
    [
      "OpenAI's older quota wording",
      "You exceeded your current quota, please check your plan and billing details",
    ],
    [
      "a full response body rather than just the message",
      '{"type":"insufficient_quota","code":"credit_balance_exhausted"}',
    ],
  ])("is permanent: %s", (_label, msg) => {
    expect(isPermanentProviderError(msg)).toBe(true);
    expect(isTransientError(msg)).toBe(false);
  });

  it("does not rely on codes that never reach error.message", () => {
    // Guards the reasoning in error-utils: these are `type`/`code` values living
    // in responseBody. If someone ever removes the prose patterns and keeps only
    // the codes, the real messages above stop matching and this suite catches it.
    expect(isPermanentProviderError(QUOTA_EXHAUSTED)).toBe(true);
    expect(QUOTA_EXHAUSTED).not.toContain("insufficient_quota");
    expect(QUOTA_EXHAUSTED).not.toContain("credit_balance_exhausted");
    expect(BAD_KEY).not.toContain("invalid_api_key");
  });

  it("leaves a genuine rate limit retryable", () => {
    // A real 429 with no quota wording still means "slow down and try again".
    expect(isPermanentProviderError("429 Rate limit exceeded")).toBe(false);
    expect(isTransientError("429 Rate limit exceeded")).toBe(true);
  });

  it("leaves server errors retryable", () => {
    for (const msg of [
      "API error: 500",
      "Service Unavailable",
      "Bad Gateway",
    ]) {
      expect(isPermanentProviderError(msg)).toBe(false);
      expect(isTransientError(msg)).toBe(true);
    }
  });

  it("does not claim ordinary failures as provider problems", () => {
    for (const msg of [
      "Network error",
      "PDF contains no readable text content",
      "Failed to extract PDF content: bad object 500 in XRef",
    ]) {
      expect(isPermanentProviderError(msg)).toBe(false);
    }
  });
});
