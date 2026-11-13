import type { TFunction } from "i18next";
import { serverErrorMessage } from "@/lib/server-error-message";

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

export function isActiveSource(source: { status: string }): boolean {
  return (
    source.status === "pending" ||
    source.status === "discovering" ||
    source.status === "crawling"
  );
}

export function hasActiveCrawl(sources: Array<{ status: string }>): boolean {
  return sources.some(isActiveSource);
}

export function getFriendlyError(
  error: { message: string; data?: unknown },
  t: TFunction,
): string {
  try {
    const parsed = JSON.parse(error.message) as Array<{
      code?: string;
      path?: string[];
      message?: string;
      maximum?: number;
      minimum?: number;
    }>;
    if (Array.isArray(parsed) && parsed.length > 0) {
      const messages = parsed.map((issue) => getFriendlyZodIssue(issue, t));
      return [...new Set(messages)].join(". ");
    }
  } catch {
    // tRPC returns plain messages for non-Zod errors.
  }
  return serverErrorMessage(t, error);
}

function getFriendlyZodIssue(
  issue: {
    code?: string;
    path?: string[];
    message?: string;
    maximum?: number;
    minimum?: number;
  },
  t: TFunction,
): string {
  const field = issue.path?.join(".") ?? "input";
  const code = issue.code ?? "";
  if (code === "too_big" && field === "maxPages") {
    return t("webSources.validation.maxPagesTooBig", { max: issue.maximum });
  }
  if (code === "too_small" && field === "maxPages") {
    return t("webSources.validation.maxPagesTooSmall", { min: issue.minimum });
  }
  if (code === "too_big" && field === "crawlDepth") {
    return t("webSources.validation.crawlDepthTooBig", { max: issue.maximum });
  }
  if (code === "too_small" && field === "crawlDepth") {
    return t("webSources.validation.crawlDepthTooSmall", {
      min: issue.minimum,
    });
  }
  if (field === "rootUrl" || field === "url") {
    return t("webSources.validation.invalidUrl");
  }
  if (/^(include|exclude)Patterns$/.test(field) && code === "too_big") {
    return t("webSources.validation.tooManyPatterns", { max: issue.maximum });
  }
  if (/^(include|exclude)Patterns\.\d+$/.test(field)) {
    return code === "too_big"
      ? t("webSources.validation.patternTooLong", { max: issue.maximum })
      : t("webSources.validation.patternInvalidCharacters");
  }
  return t("webSources.validation.invalidInput");
}
