import { cache } from "react";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import es from "../../../messages/es.json";
import de from "../../../messages/de.json";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { resolveLocale } from "@/i18n/resolve-locale";
import { createI18n, type Messages } from "@/i18n/create-i18n";
import { auth } from "@/server/auth/config";
import { logError } from "@/lib/logger";

const CATALOGS: Record<Locale, Messages> = { en, fr, es, de };

const SESSION_LOOKUP_TIMEOUT_MS = 3_000;

/** The session only picks the language, so a failed or hung lookup must not hold up the page. */
async function getSessionForLocale(headerList: Headers) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Session lookup timed out")),
      SESSION_LOOKUP_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([
      // disableRefresh: a server layout cannot forward the renewed session cookie.
      auth.api.getSession({
        headers: headerList,
        query: { disableRefresh: true },
      }),
      timeout,
    ]);
  } catch (error) {
    logError(error, "Session lookup failed while resolving the locale");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Locale and catalogs for a localized layout, read from this request.
 * Reading cookies and headers makes the layout render per request. Cached per
 * request so the layout and its metadata share one session lookup.
 */
export const getI18nProps = cache(async function getI18nProps(): Promise<{
  locale: Locale;
  messages: Messages;
  fallbackMessages?: Messages;
}> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const session = await getSessionForLocale(headerList);
  const locale = resolveLocale({
    saved: session?.user.preferredLocale,
    // The cookie is for signed-out pages: on a shared browser it holds the last
    // user's choice, which must not reach a signed-in user with no preference.
    cookie: session ? null : cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerList.get("accept-language"),
  });
  return {
    locale,
    messages: CATALOGS[locale],
    // Stored file errors are English sentences, looked up by `storedFileErrorMessage`.
    // Other keys need no fallback: `catalogs.test.ts` keeps every catalog complete.
    fallbackMessages:
      locale === DEFAULT_LOCALE
        ? undefined
        : { files: { errors: en.files.errors } },
  };
});

/** The browser tab title for dashboard pages. */
export async function generateDashboardMetadata(): Promise<Metadata> {
  const { locale, messages } = await getI18nProps();
  return { title: createI18n(locale, messages).t("nav.dashboard") };
}

/** The browser tab title for chatbot pages. */
export async function generateChatbotMetadata(): Promise<Metadata> {
  const { locale, messages } = await getI18nProps();
  return { title: createI18n(locale, messages).t("nav.chatbots") };
}
