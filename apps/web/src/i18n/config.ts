/**
 * Client-safe locale settings. Every catalog in `messages/` is supported; only
 * enabled locales can be picked. Removing one stops offering it; saved
 * preferences for it are kept and ignored.
 */
export const SUPPORTED_LOCALES = ["en", "fr", "es", "de"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const ENABLED_LOCALES: readonly Locale[] = ["en", "fr", "es", "de"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Each language named in itself, for the language picker. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

export function isEnabledLocale(
  value: unknown,
  enabled: readonly Locale[] = ENABLED_LOCALES,
): value is Locale {
  return isLocale(value) && enabled.includes(value);
}
