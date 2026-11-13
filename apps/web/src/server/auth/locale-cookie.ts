import { createAuthMiddleware } from "better-auth/api";
import { env } from "@/lib/env";
import { isEnabledLocale, LOCALE_COOKIE } from "@/i18n/config";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const LOCALE_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  maxAge: ONE_YEAR_SECONDS,
} as const;

/**
 * At sign-in, point the language cookie at this user's saved language, so the
 * sign-in pages show it after sign-out on any device. A user with no saved
 * language clears it, so a previous user's choice does not carry over.
 */
export const syncLocaleCookie = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/sign-in/email") return;

  const user = ctx.context.newSession?.user as
    { preferredLocale?: unknown } | undefined;
  if (!user) return;

  if (isEnabledLocale(user.preferredLocale)) {
    ctx.setCookie(LOCALE_COOKIE, user.preferredLocale, LOCALE_COOKIE_OPTIONS);
  } else {
    ctx.setCookie(LOCALE_COOKIE, "", { ...LOCALE_COOKIE_OPTIONS, maxAge: 0 });
  }
});
