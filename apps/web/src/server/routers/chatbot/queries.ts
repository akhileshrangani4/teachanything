import { protectedProcedure, publicProcedure } from "@/server/trpc";
import { z } from "zod";
import {
  chatbots,
  user,
  chatbotFileAssociations,
} from "@teachanything/db/schema";
import { eq, and, sql, desc, asc, ilike, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { escapeLikePattern } from "@/server/utils";
import { assertOwnedChatbot } from "@/server/queries/chatbot";

export const chatbotQueries = {
  /**
   * List user's chatbots with search and sort
   */
  list: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(10),
          offset: z.number().min(0).default(0),
          search: z.string().max(200).optional(),
          sortBy: z.enum(["name", "model", "createdAt"]).default("createdAt"),
          sortDir: z.enum(["asc", "desc"]).default("desc"),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 10;
      const offset = input?.offset ?? 0;

      // Build search condition (escape LIKE wildcards for literal matching)
      const searchCondition = input?.search
        ? or(
            ilike(chatbots.name, `%${escapeLikePattern(input.search)}%`),
            ilike(chatbots.description, `%${escapeLikePattern(input.search)}%`),
          )
        : undefined;

      // Combine with user filter
      const whereCondition = searchCondition
        ? and(eq(chatbots.userId, ctx.session.user.id), searchCondition)
        : eq(chatbots.userId, ctx.session.user.id);

      // Get total count with search filter
      const [totalCountResult] = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(chatbots)
        .where(whereCondition);

      const totalCount = Number(totalCountResult?.count || 0);

      // Build sort order
      const sortColumn =
        input?.sortBy === "name"
          ? chatbots.name
          : input?.sortBy === "model"
            ? chatbots.model
            : chatbots.createdAt;
      const orderBy =
        input?.sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

      // Get paginated chatbots
      const userChatbots = await ctx.db
        .select()
        .from(chatbots)
        .where(whereCondition)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset);

      return {
        chatbots: userChatbots,
        totalCount,
      };
    }),

  /**
   * Get single chatbot by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return assertOwnedChatbot(ctx, input.id);
    }),

  /**
   * Get single chatbot by ID (alias for getById)
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return assertOwnedChatbot(ctx, input.id);
    }),

  /**
   * Get chatbot by share token (public)
   */
  getByShareToken: publicProcedure
    .input(z.object({ shareToken: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const [chatbot] = await ctx.db
        .select({
          id: chatbots.id,
          name: chatbots.name,
          description: chatbots.description,
          model: chatbots.model,
          welcomeMessage: chatbots.welcomeMessage,
          suggestedQuestions: chatbots.suggestedQuestions,
          shareToken: chatbots.shareToken,
          showSources: chatbots.showSources,
          customAuthorName: chatbots.customAuthorName,
        })
        .from(chatbots)
        .where(
          and(
            eq(chatbots.shareToken, input.shareToken),
            eq(chatbots.sharingEnabled, true),
          ),
        )
        .limit(1);

      if (!chatbot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chatbot not found or not shared",
        });
      }

      return chatbot;
    }),

  /**
   * Get featured chatbots (public)
   * Returns up to 4 featured chatbots with creator info and file counts
   */
  getFeatured: publicProcedure.query(async ({ ctx }) => {
    const featuredChatbots = await ctx.db
      .select({
        id: chatbots.id,
        name: chatbots.name,
        description: chatbots.description,
        createdAt: chatbots.createdAt,
        shareToken: chatbots.shareToken,
        customAuthorName: chatbots.customAuthorName,
        userName: user.name,
        fileCount: sql<number>`
          (SELECT COUNT(*)::int 
           FROM ${chatbotFileAssociations} 
           WHERE ${chatbotFileAssociations.chatbotId} = ${chatbots.id})
        `,
      })
      .from(chatbots)
      .leftJoin(user, eq(chatbots.userId, user.id))
      .where(eq(chatbots.featured, true))
      .orderBy(desc(chatbots.createdAt))
      .limit(4);

    return featuredChatbots;
  }),
};
