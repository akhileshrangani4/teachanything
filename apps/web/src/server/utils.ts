import { z } from "zod";

/**
 * Escapes SQL LIKE wildcards (%, _) and the backslash escape char itself.
 * Backslashes must be escaped first so a trailing `\` in user input doesn't
 * produce an invalid pattern (e.g. `%foo\%` with a dangling escape).
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Session ids are client-minted nanoids; mirrors the prior tRPC bound.
 * Shared by the chat and study-tool request schemas so both surfaces
 * accept exactly the same shape.
 */
export const sessionIdSchema = z
  .string()
  .min(10)
  .max(30)
  .regex(/^[a-zA-Z0-9_-]+$/);

/**
 * Truncates a preview string to 100 chars with an ellipsis. Returns null
 * for null or empty input so callers can branch on "no preview available".
 */
export function formatPreview(firstUserMessage: string | null): string | null {
  if (!firstUserMessage) return null;
  return firstUserMessage.length > 100
    ? firstUserMessage.slice(0, 100) + "..."
    : firstUserMessage;
}
