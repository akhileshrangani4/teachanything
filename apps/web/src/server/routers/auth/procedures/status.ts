import { publicProcedure, protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { user } from "@teachanything/db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { checkRateLimit, userStatusProbeRateLimit } from "@/server/rate-limit";
import { getTrustedClientIp } from "@/lib/get-client-ip";

/**
 * Get current user status
 */
export const getStatusProcedure = publicProcedure.query(async ({ ctx }) => {
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
});

/**
 * Check user status by email (for login error handling)
 *
 * This reveals whether an email is registered and its approval state, so
 * it is rate limited per IP (fail closed) to prevent account enumeration
 * scans.
 */
export const checkUserStatusProcedure = publicProcedure
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
  });

/**
 * Check if user's account is approved
 */
export const checkApprovalStatusProcedure = protectedProcedure.query(
  async ({ ctx }) => {
    const user = ctx.session.user;
    return {
      status: user.status,
      isApproved: user.status === "approved",
      isPending: user.status === "pending",
      isRejected: user.status === "rejected",
    };
  },
);
