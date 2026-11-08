import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { account } from "@teachanything/db/schema";
import { eq, and } from "drizzle-orm";
import * as bcrypt from "bcryptjs";
import { requireRateLimit, passwordUpdateRateLimit } from "@/server/rate-limit";
import { logError } from "@/lib/logger";
import { auth } from "@/server/auth";
import { deleteUserAccount } from "@/server/services/user-deletion";
import { appError } from "@/server/app-error";
import { retryAfterMinutes } from "@/lib/constants/rate-limits";

/**
 * Delete the current user's own account permanently.
 * Requires password confirmation. Admins cannot self-delete (use admin panel).
 */
export const deleteOwnAccountProcedure = protectedProcedure
  .input(
    z.object({
      password: z.string().min(1),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const currentUser = ctx.session.user;

    // Rate limiting: shares budget with password updates (5 attempts/hour)
    // Uses requireRateLimit to fail closed if Redis is unavailable
    const { success, reset } = await requireRateLimit(
      passwordUpdateRateLimit,
      userId,
      { userId, endpoint: "deleteOwnAccount" },
    );

    if (!success) {
      throw appError("TOO_MANY_REQUESTS", "errors.rateLimits.attempts", {
        minutes: retryAfterMinutes(reset),
      });
    }

    // Admins must be demoted before self-deleting to prevent accidental lockout
    if (currentUser.role === "admin") {
      throw appError("BAD_REQUEST", "errors.account.adminSelfDelete");
    }

    // Verify password before proceeding
    const [userAccount] = await ctx.db
      .select()
      .from(account)
      .where(
        and(eq(account.userId, userId), eq(account.providerId, "credential")),
      )
      .limit(1);

    if (!userAccount || !userAccount.password) {
      throw appError("BAD_REQUEST", "errors.account.passwordAccountNotFound");
    }

    const isValidPassword = await bcrypt.compare(
      input.password,
      userAccount.password,
    );

    if (!isValidPassword) {
      throw appError("UNAUTHORIZED", "errors.account.incorrectPassword");
    }

    try {
      // Revoke all sessions before deletion for defense-in-depth
      try {
        await auth.api.revokeSessions({ headers: ctx.headers });
      } catch {
        // Session revocation is best-effort; cascade delete will clean up
      }

      await deleteUserAccount(ctx.db, {
        userId,
        email: currentUser.email,
        name: currentUser.name || "User",
      });

      return { success: true };
    } catch (error) {
      logError(error, "Failed to delete own account", {
        userId,
        email: currentUser.email,
      });
      throw appError("INTERNAL_SERVER_ERROR", "errors.account.deleteFailed");
    }
  });
