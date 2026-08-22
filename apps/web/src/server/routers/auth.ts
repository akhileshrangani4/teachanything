import { router, publicProcedure, protectedProcedure } from "../trpc";
import { z } from "zod";
import { user, account } from "@teachanything/db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import * as bcrypt from "bcryptjs";
import {
  requireRateLimit,
  passwordUpdateRateLimit,
  checkRateLimit,
  userStatusProbeRateLimit,
} from "@/server/rate-limit";
import { validatePasswordStrength } from "@/lib/password/password-strength";
import { isPasswordDifferent } from "@/lib/password/password-validation";
import { logInfo, logError, logWarn } from "@/lib/logger";
import { auth } from "@/server/auth";
import { deleteUserAccount } from "@/server/services/user-deletion";
import { getTrustedClientIp } from "@/lib/get-client-ip";

export const authRouter = router({
  /**
   * Get current user status
   */
  getStatus: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session || !ctx.session.user) {
      return {
        authenticated: false,
        user: null,
      };
    }

    const user = ctx.session.user;
    return {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    };
  }),

  /**
   * Check user status by email (for login error handling)
   *
   * This reveals whether an email is registered and its approval state, so
   * it is rate limited per IP (fail closed) to prevent account enumeration
   * scans.
   */
  checkUserStatus: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ ctx, input }) => {
      const clientIp = getTrustedClientIp(ctx.headers);
      const probe = await checkRateLimit(
        userStatusProbeRateLimit,
        clientIp,
        { context: "user-status-probe" },
        false,
      );
      if (!probe.success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please try again later.",
        });
      }

      const [foundUser] = await ctx.db
        .select({ status: user.status })
        .from(user)
        .where(eq(user.email, input.email))
        .limit(1);

      if (!foundUser) {
        return { exists: false, status: null };
      }

      return {
        exists: true,
        status: foundUser.status,
      };
    }),

  /**
   * Check if user's account is approved
   */
  checkApprovalStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.session.user;
    return {
      status: user.status,
      isApproved: user.status === "approved",
      isPending: user.status === "pending",
      isRejected: user.status === "rejected",
    };
  }),

  /**
   * Get current user's profile including verification fields
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const [userData] = await ctx.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        title: user.title,
        institutionalAffiliation: user.institutionalAffiliation,
        department: user.department,
        facultyWebpage: user.facultyWebpage,
        country: user.country,
        status: user.status,
        role: user.role,
      })
      .from(user)
      .where(eq(user.id, ctx.session.user.id))
      .limit(1);

    if (!userData) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Check if profile is complete (all fields required)
    const isProfileComplete = Boolean(
      userData.title &&
      userData.institutionalAffiliation &&
      userData.department &&
      userData.facultyWebpage,
    );

    return {
      ...userData,
      isProfileComplete,
    };
  }),

  /**
   * Update user profile (verification fields)
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(100),
        institutionalAffiliation: z.string().trim().min(1).max(200),
        department: z.string().trim().min(1).max(200),
        country: z.string().trim().min(1).max(100),
        facultyWebpage: z.string().trim().url().max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(user)
        .set({
          title: input.title,
          institutionalAffiliation: input.institutionalAffiliation,
          department: input.department,
          country: input.country,
          facultyWebpage: input.facultyWebpage,
          updatedAt: new Date(),
        })
        .where(eq(user.id, ctx.session.user.id));

      logInfo("User profile updated", {
        userId: ctx.session.user.id,
        email: ctx.session.user.email,
      });

      return { success: true };
    }),

  /**
   * Update user name
   */
  updateName: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(user)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(user.id, ctx.session.user.id));

      return { success: true };
    }),

  /**
   * Update user password
   */
  updatePassword: protectedProcedure
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
            message:
              "New password must be different from your current password",
          });
        }
      } catch (error) {
        if (error instanceof TRPCError && error.code === "BAD_REQUEST") {
          throw error; // Re-throw our validation error
        }
        // Comparison can fail on a hash-format mismatch; better-auth's
        // changePassword still verifies properly, so continue — but log the
        // anomaly rather than discarding it.
        logWarn(
          "Password-difference check failed; deferring to changePassword",
          {
            userId,
            error: error instanceof Error ? error.message : String(error),
          },
        );
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
    }),

  /**
   * Delete the current user's own account permanently.
   * Requires password confirmation. Admins cannot self-delete (use admin panel).
   */
  deleteOwnAccount: protectedProcedure
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
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many attempts. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
        });
      }

      // Admins must be demoted before self-deleting to prevent accidental lockout
      if (currentUser.role === "admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Admin accounts cannot be self-deleted. Please contact another admin to demote your account first.",
        });
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
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Password account not found",
        });
      }

      const isValidPassword = await bcrypt.compare(
        input.password,
        userAccount.password,
      );

      if (!isValidPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Incorrect password",
        });
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
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete account",
        });
      }
    }),
});
