import { describe, it, expect } from "@jest/globals";
import { isTransientError } from "@teachanything/ai/error-utils";

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
