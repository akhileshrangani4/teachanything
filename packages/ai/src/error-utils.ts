/**
 * Failures that arrive wearing a retryable-looking status but can never succeed
 * on a retry.
 *
 * Why this matters: OpenAI reports an exhausted prepaid balance as HTTP **429**,
 * so the bare `429` test in `isTransientError` read a permanent billing
 * condition as backpressure and retried it three times with 1s/2s/4s backoff,
 * per embedding call. At ~40 chunks per file in micro-batches of 10 that is
 * roughly 28 seconds spent waiting out something only a human with a credit card
 * can clear, and a large enough file can spend the process-file route's whole
 * 300s `maxDuration` doing it, get killed mid-run, and leave the row claimed in
 * `processing` for the stale sweep to reap.
 *
 * The patterns are prose, not codes, because of what the caller actually
 * receives. `generateEmbedding` passes `lastError.message`, and the AI SDK sets
 * `AI_APICallError.message` to OpenAI's `error.message` verbatim -- the machine
 * readable `type` and `code` stay behind in `responseBody`/`data`. Verified
 * against a live 401:
 *
 *   message:  "Incorrect API key provided: sk-proj-****0000. You can find your
 *              API key at https://platform.openai.com/account/api-keys."
 *   data:     { error: { type: "invalid_request_error", code: "invalid_api_key" } }
 *
 * and against a live 429 captured while the balance was empty:
 *
 *   message:  "You have no credits remaining. Add credits to continue using the
 *              API at https://platform.openai.com/settings/organization/billing/."
 *   type/code: insufficient_quota / credit_balance_exhausted
 *
 * So `no credits remaining` and `incorrect api key` are the patterns that do the
 * work here. `exceeded your current quota` covers OpenAI's other, older wording
 * for the same condition. The bare `insufficient_quota` / `credit_balance_exhausted`
 * / `invalid_api_key` codes are kept for a caller that hands over a full
 * response body rather than just the message; they will not match `.message`.
 *
 * Auth failures belong here for the same reason as quota: a revoked or wrong key
 * is not going to become valid four seconds later.
 */
export function isPermanentProviderError(errorMessage: string): boolean {
  return /insufficient_quota|credit_balance_exhausted|billing_hard_limit_reached|no credits remaining|exceeded your current quota|invalid_api_key|incorrect api key/i.test(
    errorMessage,
  );
}

/**
 * Check if an error message indicates a transient/retryable error
 * (rate limits or server errors that may resolve on retry).
 */
export function isTransientError(errorMessage: string): boolean {
  // Checked first, because a quota-exhausted response IS a 429 and would
  // otherwise match the status test below.
  if (isPermanentProviderError(errorMessage)) return false;

  return (
    /\b429\b/.test(errorMessage) ||
    /\b500\b/.test(errorMessage) ||
    /\b502\b/.test(errorMessage) ||
    /\b503\b/.test(errorMessage) ||
    errorMessage.includes("Rate limit") ||
    errorMessage.includes("rate_limit") ||
    errorMessage.includes("Internal Server Error") ||
    errorMessage.includes("Bad Gateway") ||
    errorMessage.includes("Service Unavailable")
  );
}
