import { TRPCError } from "@trpc/server";
import type { ParseKeys } from "i18next";
import en from "../../messages/en.json";
import { createI18n } from "@/i18n/create-i18n";

type ErrorValues = Record<string, string | number>;

const english = createI18n("en", en);

/** Carries a catalog key to the tRPC formatter, which sends it to the client. */
export class AppErrorCause extends Error {
  constructor(
    readonly key: ParseKeys,
    readonly values?: ErrorValues,
  ) {
    super(key);
    this.name = "AppErrorCause";
  }
}

/**
 * A tRPC error the dashboard can show in the user's language. The message stays
 * safe English from the catalog, for logs and for pages that are not translated.
 */
export function appError(
  code: TRPCError["code"],
  key: ParseKeys,
  values?: ErrorValues,
): TRPCError {
  return new TRPCError({
    code,
    message: english.t(key, values ?? {}) as string,
    cause: new AppErrorCause(key, values),
  });
}
