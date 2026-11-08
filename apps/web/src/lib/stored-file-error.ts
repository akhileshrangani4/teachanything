import type { i18n as I18n } from "i18next";
import { serverErrorMessage } from "@/lib/server-error-message";

// Not anchored at the start: extraction stores it behind "Failed to extract content: ".
const UNSUPPORTED_TYPE = /Unsupported file type: (.+)$/;

/**
 * A file's stored processing error in the user's language. The pipeline stores
 * English sentences from `files.errors`, so old records translate too. Anything
 * else stays as stored.
 */
export function storedFileErrorMessage(i18n: I18n, stored: string): string {
  const unsupported = UNSUPPORTED_TYPE.exec(stored);
  if (unsupported) {
    return i18n.t("files.errors.unsupportedType", { type: unsupported[1] });
  }
  const english = i18n.getResourceBundle("en", "translation") as
    { files?: { errors?: Record<string, string> } } | undefined;
  const key = Object.entries(english?.files?.errors ?? {}).find(
    ([, message]) => message === stored,
  )?.[0];
  return key ? (i18n.t(`files.errors.${key}` as never) as string) : stored;
}

/** Whether the server refused a file because its processing failed. */
export function isFailedFileError(error: { data?: unknown }): boolean {
  const key = (
    error.data as { i18n?: { key?: string } | null } | null | undefined
  )?.i18n?.key;
  return (
    key === "errors.files.failedToProcess" ||
    key === "errors.files.failedToProcessWithReason"
  );
}

/**
 * A failed "add file to chatbot" error. The server puts the file's stored English
 * error inside the sentence, so translate that part before the sentence is built.
 */
export function fileAssociationErrorMessage(
  i18n: I18n,
  error: { message: string; data?: unknown },
): string {
  const data = error.data as
    | {
        i18n?: { key: string; values?: Record<string, string | number> } | null;
      }
    | null
    | undefined;
  const reason = data?.i18n?.values?.error;
  if (
    data?.i18n?.key !== "errors.files.failedToProcessWithReason" ||
    typeof reason !== "string"
  ) {
    return serverErrorMessage(i18n.t, error);
  }
  return serverErrorMessage(i18n.t, {
    message: error.message,
    data: {
      ...data,
      i18n: {
        ...data.i18n,
        values: { error: storedFileErrorMessage(i18n, reason) },
      },
    },
  });
}
