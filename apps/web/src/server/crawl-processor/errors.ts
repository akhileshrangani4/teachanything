/**
 * Signals that the source stopped being ours to advance -- stopped by the user
 * or timed out by the stale sweep -- so the caller unwinds without writing a
 * failure over the status that already settled it.
 */
export class CrawlNoLongerRunningError extends Error {
  constructor() {
    super("Crawl is no longer running");
    this.name = "CrawlNoLongerRunningError";
  }
}

/**
 * Signals that the page vanished under us because the user deleted its source.
 * That is a normal outcome now that deletion is allowed mid-crawl, so it
 * unwinds the transaction without taking the failure path.
 */
export class CrawledPageDeletedError extends Error {
  constructor() {
    super("Crawled page was deleted while it was being processed");
    this.name = "CrawledPageDeletedError";
  }
}

export function getFriendlyErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("Incorrect API key") || msg.includes("API key"))
    return "Embedding failed: invalid API key. Please check your OpenAI key.";
  if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND"))
    return "Could not connect to the page. The site may be down or blocking requests.";
  if (msg.includes("timeout") || msg.includes("ETIMEDOUT"))
    return "The page took too long to respond.";
  if (msg.includes("robots.txt") || msg.includes("disallowed"))
    return "This page is blocked by the site's robots.txt.";
  if (msg.includes("404") || msg.includes("Not Found"))
    return "Page not found (404).";
  if (msg.includes("403") || msg.includes("Forbidden"))
    return "Access to this page is forbidden (403).";
  if (msg.includes("429") || msg.includes("Too Many Requests"))
    return "Rate limited by the site. Try again later.";
  if (msg.includes("No content") || msg.includes("empty"))
    return "No readable content found on this page.";
  return "Failed to process this page. It may be unavailable or unsupported.";
}
