"use client";

import { useEffect, useMemo } from "react";
import { I18nextProvider } from "react-i18next";
import type { Locale } from "./config";
import { createI18n, type Messages } from "./create-i18n";

interface I18nProviderProps {
  locale: Locale;
  messages: Messages;
  fallbackMessages?: Messages;
  /** Set on localized layouts: marks the subtree's language for assistive tech. */
  shouldMarkLanguage?: boolean;
  children: React.ReactNode;
}

export function I18nProvider({
  locale,
  messages,
  fallbackMessages,
  shouldMarkLanguage = false,
  children,
}: I18nProviderProps) {
  const i18n = useMemo(
    () => createI18n(locale, messages, fallbackMessages),
    [locale, messages, fallbackMessages],
  );

  useEffect(() => {
    if (!shouldMarkLanguage) return;
    const previous = document.documentElement.lang;
    document.documentElement.lang = locale;
    return () => {
      if (document.documentElement.lang === locale) {
        document.documentElement.lang = previous || "en";
      }
    };
  }, [locale, shouldMarkLanguage]);

  return (
    <I18nextProvider i18n={i18n}>
      {shouldMarkLanguage ? <div lang={locale}>{children}</div> : children}
    </I18nextProvider>
  );
}
