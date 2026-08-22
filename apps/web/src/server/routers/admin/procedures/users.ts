import { adminProcedure } from "@/server/trpc";
import { z } from "zod";
import { user } from "@teachanything/db/schema";
import { eq, sql, desc, asc, ilike, or, and } from "drizzle-orm";
import { escapeLikePattern } from "@/server/utils";
import {
  approveUser as approveUserHelper,
  rejectUser as rejectUserHelper,
} from "@/server/auth";

/**
 * Get all pending users with pagination, search, and sorting
 */
export const getPendingUsersProcedure = adminProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100).default(10),
      offset: z.number().min(0).default(0),
      search: z.string().max(200).optional(),
      sortBy: z.enum(["name", "email", "createdAt"]).default("createdAt"),
      sortDir: z.enum(["asc", "desc"]).default("desc"),
    }),
  )
  .query(async ({ ctx, input }) => {
    // Build search condition (escape LIKE wildcards for literal matching)
    const searchCondition = input.search
      ? or(
          ilike(user.name, `%${escapeLikePattern(input.search)}%`),
          ilike(user.email, `%${escapeLikePattern(input.search)}%`),
        )
      : undefined;

    // Combine with status filter
    const whereCondition = searchCondition
      ? and(eq(user.status, "pending"), searchCondition)
      : eq(user.status, "pending");

    // Get total count with search filter
    const [totalCountResult] = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .where(whereCondition);

    const totalCount = Number(totalCountResult?.count || 0);

    // Build sort order
    const sortColumn =
      input.sortBy === "name"
        ? user.name
        : input.sortBy === "email"
          ? user.email
          : user.createdAt;
    const orderBy =
      input.sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

    // Get paginated pending users
    const pendingUsers = await ctx.db
      .select()
      .from(user)
      .where(whereCondition)
      .orderBy(orderBy)
      .limit(input.limit)
      .offset(input.offset);

    return {
      users: pendingUsers,
      totalCount,
    };
  });

/**
 * Approve user
 */
export const approveUserProcedure = adminProcedure
  .input(z.object({ userId: z.string().min(1) })) // Better Auth uses nanoid, not UUID
  .mutation(async ({ input }) => {
    await approveUserHelper(input.userId);
    return { success: true };
  });

/**
 * Reject user
 */
export const rejectUserProcedure = adminProcedure
  .input(z.object({ userId: z.string().min(1) })) // Better Auth uses nanoid, not UUID
  .mutation(async ({ input }) => {
    await rejectUserHelper(input.userId);
    return { success: true };
  });

/**
 * Get all users (admin view) with pagination
 */
export const getAllUsersProcedure = adminProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100).default(10),
      offset: z.number().min(0).default(0),
      search: z.string().max(200).optional(),
      sortBy: z
        .enum(["name", "email", "role", "status", "createdAt"])
        .default("createdAt"),
      sortDir: z.enum(["asc", "desc"]).default("desc"),
    }),
  )
  .query(async ({ ctx, input }) => {
    // Build search condition (escape LIKE wildcards for literal matching)
    const searchCondition = input.search
      ? or(
          ilike(user.name, `%${escapeLikePattern(input.search)}%`),
          ilike(user.email, `%${escapeLikePattern(input.search)}%`),
        )
      : undefined;

    // Get total count with search filter
    const baseCountQuery = ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(user);
    const [totalCountResult] = searchCondition
      ? await baseCountQuery.where(searchCondition)
      : await baseCountQuery;

    const totalCount = Number(totalCountResult?.count || 0);

    // Build sort order
    const sortColumn =
      input.sortBy === "name"
        ? user.name
        : input.sortBy === "email"
          ? user.email
          : input.sortBy === "role"
            ? user.role
            : input.sortBy === "status"
              ? user.status
              : user.createdAt;
    const orderBy =
      input.sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

    // Get paginated users
    const baseUsersQuery = ctx.db.select().from(user);
    const allUsers = searchCondition
      ? await baseUsersQuery
          .where(searchCondition)
          .orderBy(orderBy)
          .limit(input.limit)
          .offset(input.offset)
      : await baseUsersQuery
          .orderBy(orderBy)
          .limit(input.limit)
          .offset(input.offset);

    return {
      users: allUsers,
      totalCount,
    };
  });

/**
 * Get user statistics (admin view)
 * Returns accurate counts for all user statuses and roles
 */
export const getUserStatsProcedure = adminProcedure.query(async ({ ctx }) => {
  // One GROUP BY pass instead of five separate count queries.
  const rows = await ctx.db
    .select({
      isAdmin: sql<number>`(${user.role} = 'admin')::int`,
      status: user.status,
      count: sql<number>`count(*)::int`,
    })
    .from(user)
    .groupBy(user.role, user.status);

  let total = 0;
  let admins = 0;
  const byStatus: Record<string, number> = {
    approved: 0,
    pending: 0,
    rejected: 0,
  };
  for (const row of rows) {
    const count = Number(row.count);
    total += count;
    if (row.isAdmin) admins += count;
    byStatus[row.status] = (byStatus[row.status] ?? 0) + count;
  }

  return {
    total,
    admins,
    approved: byStatus.approved ?? 0,
    pending: byStatus.pending ?? 0,
    rejected: byStatus.rejected ?? 0,
  };
});
