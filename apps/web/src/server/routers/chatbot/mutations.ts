import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { chatbots } from "@teachanything/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { checkRateLimit, chatbotCreationRateLimit } from "@/server/rate-limit";
import { assertOwnedChatbot } from "@/server/queries/chatbot";
import { createChatbotSchema } from "./schemas";
import { appError } from "@/server/app-error";
import { retryAfterHours } from "@/lib/constants/rate-limits";

export const chatbotMutations = {
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
        throw appError(
          "TOO_MANY_REQUESTS",
          "errors.rateLimits.chatbotCreation",
          {
            hours: retryAfterHours(reset),
          },
        );
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
      await assertOwnedChatbot(ctx, input.id);

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
      const chatbot = await assertOwnedChatbot(ctx, input.id);

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
      await assertOwnedChatbot(ctx, input.id);

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
      const existing = await assertOwnedChatbot(ctx, input.id);

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
        throw appError("NOT_FOUND", "errors.notFoundItems.chatbot");
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
      await assertOwnedChatbot(ctx, input.id);

      // Keep shareToken but disable sharing
      await ctx.db
        .update(chatbots)
        .set({ sharingEnabled: false, updatedAt: new Date() })
        .where(eq(chatbots.id, input.id));

      return { success: true };
    }),
};
