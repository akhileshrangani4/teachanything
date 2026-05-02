export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed && !trimmed.match(/^https?:\/\//i)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function parsePatternList(value: string): string[] {
  return value
    ? value
        .split(",")
        .map((pattern) => pattern.trim())
        .filter(Boolean)
    : [];
}

export function hasActiveCrawl(sources: Array<{ status: string }>): boolean {
  return sources.some(
    (source) =>
      source.status === "pending" ||
      source.status === "discovering" ||
      source.status === "crawling",
  );
}

export function getFriendlyError(error: { message: string }): string {
  try {
    const parsed = JSON.parse(error.message) as Array<{
      code?: string;
      path?: string[];
      message?: string;
      maximum?: number;
      minimum?: number;
    }>;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(getFriendlyZodIssue).join(". ");
    }
  } catch {
    // tRPC returns plain messages for non-Zod errors.
  }
  return error.message;
}

function getFriendlyZodIssue(issue: {
  code?: string;
  path?: string[];
  message?: string;
  maximum?: number;
  minimum?: number;
}): string {
  const field = issue.path?.join(".") ?? "input";
  const code = issue.code ?? "";
  if (code === "too_big" && field === "maxPages") {
    return `Max pages cannot exceed ${issue.maximum}`;
  }
  if (code === "too_small" && field === "maxPages") {
    return `Max pages must be at least ${issue.minimum}`;
  }
  if (code === "too_big" && field === "crawlDepth") {
    return `Crawl depth cannot exceed ${issue.maximum}`;
  }
  if (code === "too_small" && field === "crawlDepth") {
    return `Crawl depth must be at least ${issue.minimum}`;
  }
  if (field === "rootUrl" || field === "url") {
    return "Please enter a valid URL";
  }
  return issue.message ?? "Invalid input";
}
