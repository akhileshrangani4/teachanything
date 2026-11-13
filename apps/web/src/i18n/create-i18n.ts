import { createInstance, type i18n } from "i18next";
import ICU from "i18next-icu";
import { DEFAULT_LOCALE, type Locale } from "./config";

export type Messages = Record<string, unknown>;

/**
 * A synchronous i18next instance for one locale. Catalogs use ICU message
 * syntax ({count, plural, …}), so the ICU plugin does the formatting. A key
 * missing from a translation falls back to English if `fallbackMessages` has it.
 */
export function createI18n(
  locale: Locale,
  messages: Messages,
  fallbackMessages?: Messages,
): i18n {
  const instance = createInstance();
  instance.use(ICU).init({
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    resources: {
      [locale]: { translation: messages },
      ...(fallbackMessages && locale !== DEFAULT_LOCALE
        ? { [DEFAULT_LOCALE]: { translation: fallbackMessages } }
        : {}),
    },
    initAsync: false,
    nsSeparator: false,
    returnNull: false,
    interpolation: { escapeValue: false },
  });
  return instance;
}
