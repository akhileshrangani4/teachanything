import { adminProcedure } from "@/server/trpc";
import { z } from "zod";
import {
  user,
  chatbots,
  chatbotFileAssociations,
} from "@teachanything/db/schema";
import { eq, sql, desc, asc, ilike, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { escapeLikePattern } from "@/server/utils";

/**
 * Get all chatbots (admin view) with owner info and file counts
 * Paginated with limit and offset
 */
export const getAllChatbotsProcedure = adminProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100).default(10),
      offset: z.number().min(0).default(0),
      search: z.string().max(200).optional(),
      sortBy: z
        .enum(["name", "owner", "model", "createdAt", "featured", "fileCount"])
        .default("createdAt"),
      sortDir: z.enum(["asc", "desc"]).default("desc"),
    }),
  )
  .query(async ({ ctx, input }) => {
    // Build search condition (escape LIKE wildcards for literal matching)
    const searchCondition = input.search
      ? (() => {
          const escaped = escapeLikePattern(input.search);
          return or(
            ilike(chatbots.name, `%${escaped}%`),
            ilike(chatbots.description, `%${escaped}%`),
            ilike(user.name, `%${escaped}%`),
            ilike(user.email, `%${escaped}%`),
          );
        })()
      : undefined;

    // Get total count with search filter
    const baseCountQuery = ctx.db
      .select({ count: sql<number>`count(distinct ${chatbots.id})` })
      .from(chatbots)
      .leftJoin(user, eq(chatbots.userId, user.id));

    const [totalCountResult] = searchCondition
      ? await baseCountQuery.where(searchCondition)
      : await baseCountQuery;
    const totalCount = Number(totalCountResult?.count || 0);

    // Get featured count
    const [featuredCountResult] = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(chatbots)
      .where(eq(chatbots.featured, true));
    const featuredCount = Number(featuredCountResult?.count || 0);

    // Build sort order - fileCount requires special handling as it's an aggregate
    const fileCountExpr = sql<number>`count(distinct ${chatbotFileAssociations.id})`;
    const sortColumn =
      input.sortBy === "name"
        ? chatbots.name
        : input.sortBy === "owner"
          ? user.name
          : input.sortBy === "model"
            ? chatbots.model
            : input.sortBy === "featured"
              ? chatbots.featured
              : input.sortBy === "fileCount"
                ? fileCountExpr
                : chatbots.createdAt;
    const orderBy =
      input.sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

    // Get paginated chatbots
    const baseQuery = ctx.db
      .select({
        id: chatbots.id,
        name: chatbots.name,
        description: chatbots.description,
        model: chatbots.model,
        createdAt: chatbots.createdAt,
        updatedAt: chatbots.updatedAt,
        userId: chatbots.userId,
        featured: chatbots.featured,
        sharingEnabled: chatbots.sharingEnabled,
        customAuthorName: chatbots.customAuthorName,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        fileCount: sql<number>`cast(count(distinct ${chatbotFileAssociations.id}) as int)`,
      })
      .from(chatbots)
      .leftJoin(user, eq(chatbots.userId, user.id))
      .leftJoin(
        chatbotFileAssociations,
        eq(chatbots.id, chatbotFileAssociations.chatbotId),
      );

    const queryWithFilter = searchCondition
      ? baseQuery.where(searchCondition)
      : baseQuery;

    const allChatbots = await queryWithFilter
      .groupBy(chatbots.id, user.id)
      .orderBy(orderBy)
      .limit(input.limit)
      .offset(input.offset);

    return {
      chatbots: allChatbots,
      totalCount,
      featuredCount,
    };
  });

/**
 * Toggle featured status for a chatbot (admin only)
 * Only public chatbots (sharingEnabled=true) can be featured
 * Enforces maximum of 4 featured chatbots
 */
export const toggleFeaturedProcedure = adminProcedure
  .input(z.object({ chatbotId: z.string().uuid(), featured: z.boolean() }))
  .mutation(async ({ ctx, input }) => {
    // Get the chatbot to check if it's public
    const [currentChatbot] = await ctx.db
      .select({
        featured: chatbots.featured,
        sharingEnabled: chatbots.sharingEnabled,
      })
      .from(chatbots)
      .where(eq(chatbots.id, input.chatbotId))
      .limit(1);

    if (!currentChatbot) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Chatbot not found",
      });
    }

    // If trying to set as featured, check if it's public
    if (input.featured && !currentChatbot.sharingEnabled) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only public chatbots (with sharing enabled) can be featured",
      });
    }

    // If trying to set as featured, check if we're at the limit
    if (input.featured) {
      const featuredCount = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(chatbots)
        .where(eq(chatbots.featured, true));

      const currentFeaturedCount = Number(featuredCount[0]?.count || 0);

      // If it's not already featured and we're at the limit, reject
      if (!currentChatbot.featured && currentFeaturedCount >= 4) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Maximum of 4 chatbots can be featured at once",
        });
      }
    }

    // Update the chatbot
    await ctx.db
      .update(chatbots)
      .set({
        featured: input.featured,
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, input.chatbotId));

    return { success: true };
  });

/**
 * Update author name for a chatbot (admin only)
 * Admins can only update author names for chatbots they created
 */
export const updateAuthorNameProcedure = adminProcedure
  .input(
    z.object({
      chatbotId: z.string().uuid(),
      authorName: z
        .union([
          z
            .string()
            .trim()
            .min(1, "Author name must be at least 1 character")
            .max(100, "Author name must be at most 100 characters")
            .refine(
              (val) => val.trim().length > 0,
              "Author name cannot be only whitespace",
            ),
          z.null(),
        ])
        .optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // Check if chatbot exists and is owned by the current admin
    const [existing] = await ctx.db
      .select({ id: chatbots.id, userId: chatbots.userId })
      .from(chatbots)
      .where(eq(chatbots.id, input.chatbotId))
      .limit(1);

    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Chatbot not found",
      });
    }

    // Check if the chatbot was created by the current admin
    if (existing.userId !== ctx.session.user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only update author names for chatbots you created",
      });
    }

    // Validate and trim the author name
    const trimmedName = input.authorName?.trim() || null;
    if (trimmedName && trimmedName.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Author name cannot be only whitespace",
      });
    }

    if (trimmedName && trimmedName.length > 100) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Author name must be at most 100 characters",
      });
    }

    // Update the author name
    await ctx.db
      .update(chatbots)
      .set({
        customAuthorName: trimmedName,
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, input.chatbotId));

    return { success: true };
  });

/**
 * Delete any chatbot (admin only)
 */
export const deleteChatbotProcedure = adminProcedure
  .input(z.object({ chatbotId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    // Existence check so a bad id 404s instead of reporting success on a
    // delete that matched nothing.
    const [existing] = await ctx.db
      .select({ id: chatbots.id })
      .from(chatbots)
      .where(eq(chatbots.id, input.chatbotId))
      .limit(1);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Chatbot not found",
      });
    }

    // Admin can delete any chatbot
    await ctx.db.delete(chatbots).where(eq(chatbots.id, input.chatbotId));

    return { success: true };
  });
