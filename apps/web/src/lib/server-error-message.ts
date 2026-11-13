import type { TFunction } from "i18next";

const MAX_DISPLAY_LENGTH = 300;
// What browsers say when a response is not JSON, e.g. a gateway's HTML page.
// Client errors with no `data` (upload failures) are already translated, so
// missing `data` alone cannot mark a message as unsafe.
const UNREADABLE_RESPONSE =
  /not valid json|unexpected (token|end of)|json\.parse|json parse error|did not match the expected pattern/i;

interface ErrorData {
  code?: string;
  zodError?: unknown;
  i18n?: { key: string; values?: Record<string, string | number> } | null;
}

/**
 * A tRPC error in the user's language. Errors raised with `appError` carry a
 * catalog key; the rest keep their safe English message. Internal errors and
 * unreadable responses never show their diagnostics.
 */
export function serverErrorMessage(
  t: TFunction,
  error: { message: string; data?: unknown },
): string {
  const data = (error.data ?? null) as ErrorData | null;
  if (data?.i18n) {
    return t(data.i18n.key as never, {
      ...data.i18n.values,
      defaultValue: error.message,
    }) as string;
  }
  if (data?.zodError) return t("errors.invalidInput");
  if (data?.code === "INTERNAL_SERVER_ERROR") return t("errors.generic");
  if (/failed to fetch|networkerror|load failed/i.test(error.message)) {
    return t("errors.network");
  }
  if (
    error.message.length > MAX_DISPLAY_LENGTH ||
    UNREADABLE_RESPONSE.test(error.message) ||
    /^[{<[]/.test(error.message)
  ) {
    return t("errors.generic");
  }
  return error.message;
}
