import { adminProcedure } from "@/server/trpc";
import { z } from "zod";
import { approvedDomains } from "@teachanything/db/schema";
import { eq, sql, desc, asc, ilike } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { escapeLikePattern } from "@/server/utils";
import { getApprovedDomains } from "@/lib/env";
import { validateDomainForAllowlist } from "@/lib/domain-validation";

/**
 * List all allowed domains from database with pagination
 */
export const listDomainsProcedure = adminProcedure
  .input(
    z
      .object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
        search: z.string().max(200).optional(),
        sortBy: z.enum(["domain", "createdAt"]).default("createdAt"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
      })
      .optional(),
  )
  .query(async ({ ctx, input }) => {
    const page = input?.page ?? 1;
    const limit = input?.limit ?? 50;
    const offset = (page - 1) * limit;

    // Build search condition (escape LIKE wildcards for literal matching)
    const searchCondition = input?.search
      ? ilike(approvedDomains.domain, `%${escapeLikePattern(input.search)}%`)
      : undefined;

    // Build sort order
    const sortColumn =
      input?.sortBy === "domain"
        ? approvedDomains.domain
        : approvedDomains.createdAt;
    const orderBy =
      input?.sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

    const baseQuery = searchCondition
      ? ctx.db.select().from(approvedDomains).where(searchCondition)
      : ctx.db.select().from(approvedDomains);

    const [domains, countResult] = await Promise.all([
      baseQuery.orderBy(orderBy).limit(limit).offset(offset),
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(approvedDomains)
        .where(searchCondition ?? undefined),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return {
      domains,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

/**
 * Get allowed domains from environment variables
 */
export const getEnvDomainsProcedure = adminProcedure.query(async () => {
  const envDomains = getApprovedDomains();
  return envDomains;
});

/**
 * Add allowed domain
 * Validates against Public Suffix List to prevent broad TLDs
 */
export const addDomainProcedure = adminProcedure
  .input(z.object({ domain: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    // Server-side validation using Public Suffix List
    const validation = validateDomainForAllowlist(input.domain);
    if (!validation.valid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: validation.reason || "Invalid domain",
      });
    }

    const normalizedDomain = input.domain.trim().toLowerCase();

    // Check if domain already exists
    const existing = await ctx.db
      .select()
      .from(approvedDomains)
      .where(eq(approvedDomains.domain, normalizedDomain))
      .limit(1);

    if (existing.length > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This domain is already in the allowed list",
      });
    }

    const [newDomain] = await ctx.db
      .insert(approvedDomains)
      .values({
        domain: normalizedDomain,
        createdBy: ctx.session.user.id,
      })
      .returning();

    return newDomain;
  });

/**
 * Remove allowed domain
 */
export const removeDomainProcedure = adminProcedure
  .input(z.object({ domainId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    // Existence check so a bad id 404s instead of reporting success on a
    // delete that matched nothing.
    const [existing] = await ctx.db
      .select({ id: approvedDomains.id })
      .from(approvedDomains)
      .where(eq(approvedDomains.id, input.domainId))
      .limit(1);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Domain not found",
      });
    }

    await ctx.db
      .delete(approvedDomains)
      .where(eq(approvedDomains.id, input.domainId));

    return { success: true };
  });
