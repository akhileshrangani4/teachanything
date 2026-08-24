import { router, protectedProcedure, publicProcedure } from "../trpc";
import { z } from "zod";
import {
  chatbots,
  user,
  chatbotFileAssociations,
} from "@teachanything/db/schema";
import { eq, and, sql, desc, asc, ilike, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { SUPPORTED_MODELS, DEPRECATED_MODELS } from "@teachanything/ai";
import { checkRateLimit, chatbotCreationRateLimit } from "@/lib/rate-limit";
import { escapeLikePattern } from "@/server/utils";
import {
  findChatbotForUser,
  findOwnedChatbotId,
  type ChatbotDb,
} from "@/server/queries/chatbot";

// Re-export the query helpers so existing tRPC-side imports keep working.
// The implementations live in the queries module (decoupled from tRPC
// types); non-tRPC callers like the transcribe route import them there.
export { findChatbotForUser, findOwnedChatbotId };

// Accept both current and deprecated model IDs for backwards compatibility (D-08).
// Chatbots stored with old IDs are resolved at query time via resolveModel().
const allAcceptedModels = [...SUPPORTED_MODELS, ...DEPRECATED_MODELS] as [
  string,
  ...string[],
];

async function getChatbotByIdForUser(
  db: ChatbotDb,
  chatbotId: string,
  userId: string,
) {
  const chatbot = await findChatbotForUser(db, chatbotId, userId);
  if (!chatbot) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Chatbot not found" });
  }
  return chatbot;
}

const createChatbotSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(200).optional(),
  systemPrompt: z.string().min(1).max(1000000),
  model: z.enum(allAcceptedModels),
  temperature: z.number().min(0).max(100).default(70),
  maxTokens: z.number().min(100).max(4000).default(2000),
  welcomeMessage: z.string().max(500).optional(),
  suggestedQuestions: z.array(z.string()).max(5).default([]),
  showSources: z.boolean().optional(),
});

export const chatbotRouter = router({
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
      return getChatbotByIdForUser(ctx.db, input.id, ctx.session.user.id);
    }),

  /**
   * Get single chatbot by ID (alias for getById)
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getChatbotByIdForUser(ctx.db, input.id, ctx.session.user.id);
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

  /**
   * Create new chatbot
   */
  create: protectedProcedure
    .input(createChatbotSchema)
    .mutation(async ({ ctx, input }) => {
      // Rate limiting: 10 chatbots per hour per user
      const { success, reset } = await checkRateLimit(
        chatbotCreationRateLimit,
        ctx.session.user.id,
        {
          userId: ctx.session.user.id,
          endpoint: "chatbotCreation",
        },
      );

      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many chatbot creations. Please try again in ${Math.ceil(retryAfter / 3600)} hour(s).`,
        });
      }

      // Generate shareToken automatically since sharing is enabled by default
      const shareToken = nanoid(16);

      const [newChatbot] = await ctx.db
        .insert(chatbots)
        .values({
          userId: ctx.session.user.id,
          name: input.name,
          description: input.description,
          systemPrompt: input.systemPrompt,
          model: input.model,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
          welcomeMessage: input.welcomeMessage,
          suggestedQuestions: input.suggestedQuestions,
          shareToken,
          sharingEnabled: true,
        })
        .returning();

      return newChatbot;
    }),

  /**
   * Update chatbot
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: createChatbotSchema.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check ownership
      const [existing] = await ctx.db
        .select()
        .from(chatbots)
        .where(
          and(
            eq(chatbots.id, input.id),
            eq(chatbots.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chatbot not found",
        });
      }

      const [updated] = await ctx.db
        .update(chatbots)
        .set({
          ...input.data,
          updatedAt: new Date(),
        })
        .where(eq(chatbots.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Toggle showSources display setting
   */
  updateShowSources: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        showSources: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const chatbot = await getChatbotByIdForUser(
        ctx.db,
        input.id,
        ctx.session.user.id,
      );

      await ctx.db
        .update(chatbots)
        .set({ showSources: input.showSources, updatedAt: new Date() })
        .where(eq(chatbots.id, chatbot.id));

      return { showSources: input.showSources };
    }),

  /**
   * Delete chatbot
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check ownership
      const [existing] = await ctx.db
        .select()
        .from(chatbots)
        .where(
          and(
            eq(chatbots.id, input.id),
            eq(chatbots.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chatbot not found",
        });
      }

      await ctx.db.delete(chatbots).where(eq(chatbots.id, input.id));

      return { success: true };
    }),

  /**
   * Generate share token for chatbot
   */
  generateShareToken: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check ownership
      const [existing] = await ctx.db
        .select()
        .from(chatbots)
        .where(
          and(
            eq(chatbots.id, input.id),
            eq(chatbots.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chatbot not found",
        });
      }

      // Reuse existing shareToken if it exists, otherwise generate a new one
      const shareToken = existing.shareToken || nanoid(16);

      const [updated] = await ctx.db
        .update(chatbots)
        .set({
          shareToken,
          sharingEnabled: true,
          updatedAt: new Date(),
        })
        .where(eq(chatbots.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chatbot not found",
        });
      }

      return {
        shareToken: updated.shareToken!,
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/chat/${updated.shareToken}`,
      };
    }),

  /**
   * Disable sharing for chatbot
   */
  disableSharing: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check ownership
      const [existing] = await ctx.db
        .select()
        .from(chatbots)
        .where(
          and(
            eq(chatbots.id, input.id),
            eq(chatbots.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chatbot not found",
        });
      }

      // Keep shareToken but disable sharing
      await ctx.db
        .update(chatbots)
        .set({ sharingEnabled: false, updatedAt: new Date() })
        .where(eq(chatbots.id, input.id));

      return { success: true };
    }),
});
