import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { user } from "@teachanything/db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { logInfo } from "@/lib/logger";

/**
 * Get current user's profile including verification fields
 */
export const getProfileProcedure = protectedProcedure.query(async ({ ctx }) => {
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
});

/**
 * Update user profile (verification fields)
 */
export const updateProfileProcedure = protectedProcedure
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
  });

/**
 * Update user name
 */
export const updateNameProcedure = protectedProcedure
  .input(z.object({ name: z.string().min(1).max(100) }))
  .mutation(async ({ ctx, input }) => {
    await ctx.db
      .update(user)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(user.id, ctx.session.user.id));

    return { success: true };
  });
