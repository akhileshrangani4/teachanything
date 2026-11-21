import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { user } from "@teachanything/db/schema";
import { isEnabledLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { appError } from "@/server/app-error";
import { checkRateLimit, localeUpdateRateLimit } from "@/server/rate-limit";
import { retryAfterMinutes } from "@/lib/constants/rate-limits";
import { LOCALE_COOKIE_OPTIONS } from "@/server/auth/locale-cookie";

/**
 * Save the signed-in user's dashboard language, or clear it with `null` to
 * follow the browser again. The cookie keeps a saved language on this browser
 * after sign-out, for the sign-in pages.
 */
export const updatePreferredLocaleProcedure = protectedProcedure
  .input(
    z.object({
      locale: z.custom<Locale | null>(
        (value) => value === null || isEnabledLocale(value),
        { message: "Unsupported language" },
      ),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const { success, reset } = await checkRateLimit(
      localeUpdateRateLimit,
      ctx.session.user.id,
      { userId: ctx.session.user.id, endpoint: "updatePreferredLocale" },
    );
    if (!success) {
      throw appError("TOO_MANY_REQUESTS", "errors.rateLimits.attempts", {
        minutes: retryAfterMinutes(reset),
      });
    }

    const [saved] = await ctx.db
      .update(user)
      .set({ preferredLocale: input.locale, updatedAt: new Date() })
      .where(eq(user.id, ctx.session.user.id))
      .returning({ preferredLocale: user.preferredLocale });

    if (!saved) {
      throw appError("NOT_FOUND", "errors.notFoundItems.user");
    }

    const cookieStore = await cookies();
    if (input.locale === null) {
      cookieStore.delete(LOCALE_COOKIE);
    } else {
      cookieStore.set(LOCALE_COOKIE, input.locale, LOCALE_COOKIE_OPTIONS);
    }

    return { locale: input.locale };
  });
