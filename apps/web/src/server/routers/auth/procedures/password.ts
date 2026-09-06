import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { account } from "@teachanything/db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import * as bcrypt from "bcryptjs";
import { requireRateLimit, passwordUpdateRateLimit } from "@/server/rate-limit";
import { validatePasswordStrength } from "@/lib/password/password-strength";
import { isPasswordDifferent } from "@/lib/password/password-validation";
import { logInfo, logError, logWarn } from "@/lib/logger";
import { auth } from "@/server/auth";

/**
 * Update user password
 */
export const updatePasswordProcedure = protectedProcedure
  .input(
    z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(1),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;

    // Rate limiting: 5 attempts per hour per user. Use requireRateLimit so a
    // Redis outage fails CLOSED -- this endpoint verifies the current
    // password, so a fail-open limiter would restore unbounded brute-force of
    // the existing password whenever Redis is unavailable. Mirrors
    // deleteOwnAccount (the other current-password-guarded mutation).
    const { success, reset } = await requireRateLimit(
      passwordUpdateRateLimit,
      userId,
      {
        userId,
        endpoint: "updatePassword",
      },
    );

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Too many password update attempts. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
      });
    }

    // Get user's account to check if password exists and for comparison
    const [userAccount] = await ctx.db
      .select()
      .from(account)
      .where(
        and(eq(account.userId, userId), eq(account.providerId, "credential")),
      )
      .limit(1);

    if (!userAccount || !userAccount.password) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Password account not found",
      });
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(input.newPassword);
    if (!passwordValidation.isValid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: passwordValidation.errors.join(". "),
      });
    }

    // Check if new password is different from current password
    // Note: This check might fail if password hash format doesn't match,
    // but better-auth's changePassword will handle the actual verification
    try {
      const isDifferent = await isPasswordDifferent(
        input.newPassword,
        userAccount.password,
        bcrypt.compare,
      );

      if (!isDifferent) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "New password must be different from your current password",
        });
      }
    } catch (error) {
      if (error instanceof TRPCError && error.code === "BAD_REQUEST") {
        throw error; // Re-throw our validation error
      }
      // Comparison can fail on a hash-format mismatch; better-auth's
      // changePassword still verifies properly, so continue — but log the
      // anomaly rather than discarding it.
      logWarn("Password-difference check failed; deferring to changePassword", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      // Use better-auth's changePassword API to ensure password is hashed correctly
      // This uses better-auth's internal password hashing method
      await auth.api.changePassword({
        body: {
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          revokeOtherSessions: true, // This will invalidate other sessions
        },
        headers: ctx.headers,
      });

      logInfo("Password updated successfully", {
        userId,
        email: ctx.session.user.email,
      });

      return {
        success: true,
        message:
          "Password updated successfully. Please sign in again on other devices.",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // If better-auth's changePassword fails, it might be due to password verification
      // But we already verified it above, so this is likely a different error
      logError(
        error instanceof Error ? error : new Error(String(error)),
        "Password update failed",
        {
          userId,
          error: errorMessage,
        },
      );

      // Only a *specific* verification failure from better-auth maps to
      // "wrong current password". A broad substring match ("password")
      // would misclassify unrelated faults — e.g. a hashing failure — as
      // user error and mislead the caller.
      if (
        errorMessage.includes("Invalid password") ||
        errorMessage.includes("invalid password") ||
        errorMessage.includes("Incorrect password") ||
        errorMessage.includes("credentials")
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Current password is incorrect",
        });
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update password",
      });
    }
  });
