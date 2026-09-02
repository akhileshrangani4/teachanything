import { adminProcedure } from "@/server/trpc";
import { z } from "zod";
import { user } from "@teachanything/db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { logError } from "@/lib/logger";
import {
  sendPromoteToAdminEmail,
  sendDemoteFromAdminEmail,
  sendAccountDisabledEmail,
  sendAccountEnabledEmail,
} from "@/server/email";
import { deleteUserAccount } from "@/server/services/user-deletion";
import { requireExistingUser, sendOptionalEmail } from "../helpers";

/**
 * Promote user to admin
 */
export const promoteToAdminProcedure = adminProcedure
  .input(z.object({ userId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const existingUser = await requireExistingUser(ctx, input.userId);

    // Prevent demoting yourself
    if (existingUser.id === ctx.session.user.id) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You cannot change your own admin status",
      });
    }

    // Update user role to admin and approve if pending
    await ctx.db
      .update(user)
      .set({
        role: "admin",
        status: "approved",
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(user.id, input.userId));

    // Send promotion email
    await sendOptionalEmail(
      () =>
        sendPromoteToAdminEmail({
          email: existingUser.email,
          name: existingUser.name || "User",
        }),
      "Failed to send promote to admin email",
      { userId: input.userId, email: existingUser.email },
    );

    return { success: true };
  });

/**
 * Demote admin to user
 */
export const demoteFromAdminProcedure = adminProcedure
  .input(z.object({ userId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const existingUser = await requireExistingUser(ctx, input.userId);

    // Prevent demoting yourself
    if (existingUser.id === ctx.session.user.id) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You cannot change your own admin status",
      });
    }

    // Check if user is actually an admin
    if (existingUser.role !== "admin") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "User is not an admin",
      });
    }

    // Update user role to user
    await ctx.db
      .update(user)
      .set({
        role: "user",
        updatedAt: new Date(),
      })
      .where(eq(user.id, input.userId));

    // Send demotion email
    await sendOptionalEmail(
      () =>
        sendDemoteFromAdminEmail({
          email: existingUser.email,
          name: existingUser.name || "User",
        }),
      "Failed to send demote from admin email",
      { userId: input.userId, email: existingUser.email },
    );

    return { success: true };
  });

/**
 * Disable user account (set status to rejected)
 * This will prevent the user from logging in
 */
export const disableUserProcedure = adminProcedure
  .input(z.object({ userId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const existingUser = await requireExistingUser(ctx, input.userId);

    // Prevent disabling yourself
    if (existingUser.id === ctx.session.user.id) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You cannot disable your own account",
      });
    }

    // Prevent disabling admins
    if (existingUser.role === "admin") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot disable admin accounts. Demote them to user first.",
      });
    }

    // Update user status to rejected (disabled)
    await ctx.db
      .update(user)
      .set({
        status: "rejected",
        updatedAt: new Date(),
      })
      .where(eq(user.id, input.userId));

    // Send account disabled email
    await sendOptionalEmail(
      () =>
        sendAccountDisabledEmail({
          email: existingUser.email,
          name: existingUser.name || "User",
        }),
      "Failed to send account disabled email",
      { userId: input.userId, email: existingUser.email },
    );

    return { success: true };
  });

/**
 * Re-enable user account (set status to approved)
 * This allows a previously rejected user to log in again
 */
export const enableUserProcedure = adminProcedure
  .input(z.object({ userId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const existingUser = await requireExistingUser(ctx, input.userId);

    // Update user status to approved (enabled)
    await ctx.db
      .update(user)
      .set({
        status: "approved",
        updatedAt: new Date(),
      })
      .where(eq(user.id, input.userId));

    // Send account enabled email
    await sendOptionalEmail(
      () =>
        sendAccountEnabledEmail({
          email: existingUser.email,
          name: existingUser.name || "User",
        }),
      "Failed to send account enabled email",
      { userId: input.userId, email: existingUser.email },
    );

    return { success: true };
  });

/**
 * Delete user account permanently
 * This will delete all associated data including chatbots, files, conversations, etc.
 * WARNING: This action cannot be undone!
 */
export const deleteUserProcedure = adminProcedure
  .input(z.object({ userId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const existingUser = await requireExistingUser(ctx, input.userId);

    // Prevent deleting yourself
    if (existingUser.id === ctx.session.user.id) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You cannot delete your own account",
      });
    }

    // Prevent deleting admins (must demote first)
    if (existingUser.role === "admin") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot delete admin accounts. Demote them to user first.",
      });
    }

    try {
      await deleteUserAccount(ctx.db, {
        userId: input.userId,
        email: existingUser.email,
        name: existingUser.name || "User",
        deletedBy: ctx.session.user.id,
      });

      return { success: true };
    } catch (error) {
      logError(error, "Failed to delete user", {
        userId: input.userId,
        email: existingUser.email,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete user account",
      });
    }
  });
