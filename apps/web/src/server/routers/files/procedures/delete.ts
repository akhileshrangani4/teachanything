import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  userFiles,
  chatbotFileAssociations,
  fileChunks,
} from "@teachanything/db/schema";
import { createSupabaseClient } from "@/lib/supabase";
import { isServiceAvailable } from "@/lib/env";
import { deleteLocalFile } from "@/lib/local-storage";
import { logInfo, logError } from "@/lib/logger";

/**
 * Delete file from user's library
 */
export const deleteProcedure = protectedProcedure
  .input(z.object({ fileId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    // Get file record and verify ownership
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
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "File not found",
      });
    }

    try {
      // Delete from storage
      if (isServiceAvailable("supabase-storage")) {
        const supabase = createSupabaseClient();
        const { error: storageError } = await supabase.storage
          .from("chatbot-files")
          .remove([file.storagePath]);

        if (storageError) {
          logError(storageError, "Failed to delete file from storage", {
            fileId: input.fileId,
            storagePath: file.storagePath,
          });
        }
      } else {
        await deleteLocalFile(file.storagePath);
      }

      // Delete file chunks from database
      await ctx.db
        .delete(fileChunks)
        .where(eq(fileChunks.fileId, input.fileId));

      // Delete all associations with chatbots
      await ctx.db
        .delete(chatbotFileAssociations)
        .where(eq(chatbotFileAssociations.fileId, input.fileId));

      // Delete file record from database
      await ctx.db.delete(userFiles).where(eq(userFiles.id, input.fileId));

      logInfo("File deleted", {
        fileId: input.fileId,
        userId: ctx.session.user.id,
      });

      return { success: true };
    } catch (error) {
      logError(error, "File deletion failed", {
        fileId: input.fileId,
        userId: ctx.session.user.id,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete file",
      });
    }
  });
