import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { userFiles, chatbotFileAssociations } from "@teachanything/db/schema";
import { logInfo } from "@/lib/logger";
import { assertOwnedChatbot } from "@/server/queries/chatbot";
import { appError } from "@/server/app-error";

/**
 * Associate file with chatbot
 */
export const associateWithChatbotProcedure = protectedProcedure
  .input(
    z.object({
      fileId: z.string().uuid(),
      chatbotId: z.string().uuid(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // Verify file ownership
    const [file] = await ctx.db
      .select()
      .from(userFiles)
      .where(
        and(
          eq(userFiles.id, input.fileId),
          eq(userFiles.userId, ctx.session.user.id),
        ),
      )
      .limit(1);

    if (!file) {
      throw appError("NOT_FOUND", "errors.notFoundItems.file");
    }

    // Prevent associating files that failed to process
    if (file.processingStatus === "failed") {
      throw file.metadata?.error
        ? appError("BAD_REQUEST", "errors.files.failedToProcessWithReason", {
            error: file.metadata.error,
          })
        : appError("BAD_REQUEST", "errors.files.failedToProcess");
    }

    // Warn but allow associating files that are still processing
    if (
      file.processingStatus === "processing" ||
      file.processingStatus === "pending"
    ) {
      logInfo("Associating file that is still processing", {
        fileId: input.fileId,
        chatbotId: input.chatbotId,
        processingStatus: file.processingStatus,
      });
    }

    // Verify chatbot ownership
    await assertOwnedChatbot(ctx, input.chatbotId);

    // Check if association already exists
    const [existing] = await ctx.db
      .select()
      .from(chatbotFileAssociations)
      .where(
        and(
          eq(chatbotFileAssociations.fileId, input.fileId),
          eq(chatbotFileAssociations.chatbotId, input.chatbotId),
        ),
      )
      .limit(1);

    if (existing) {
      return { success: true, alreadyAssociated: true };
    }

    // Create association
    await ctx.db.insert(chatbotFileAssociations).values({
      fileId: input.fileId,
      chatbotId: input.chatbotId,
    });

    logInfo("File associated with chatbot", {
      fileId: input.fileId,
      chatbotId: input.chatbotId,
    });

    return { success: true };
  });

/**
 * Disassociate file from chatbot
 */
export const disassociateFromChatbotProcedure = protectedProcedure
  .input(
    z.object({
      fileId: z.string().uuid(),
      chatbotId: z.string().uuid(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // Verify file ownership
    const [file] = await ctx.db
      .select()
      .from(userFiles)
      .where(
        and(
          eq(userFiles.id, input.fileId),
          eq(userFiles.userId, ctx.session.user.id),
        ),
      )
      .limit(1);

    if (!file) {
      throw appError("NOT_FOUND", "errors.notFoundItems.file");
    }

    // Verify chatbot ownership
    await assertOwnedChatbot(ctx, input.chatbotId);

    // Delete association
    await ctx.db
      .delete(chatbotFileAssociations)
      .where(
        and(
          eq(chatbotFileAssociations.fileId, input.fileId),
          eq(chatbotFileAssociations.chatbotId, input.chatbotId),
        ),
      );

    logInfo("File disassociated from chatbot", {
      fileId: input.fileId,
      chatbotId: input.chatbotId,
    });

    return { success: true };
  });
