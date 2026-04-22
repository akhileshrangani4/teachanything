/**
 * Check if an error message indicates a transient/retryable error
 * (rate limits or server errors that may resolve on retry).
 */
export function isTransientError(errorMessage: string): boolean {
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
