import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import {
  userFiles,
  chatbotFileAssociations,
  fileChunks,
} from "@teachanything/db/schema";
import { createSupabaseClient } from "@/server/supabase";
import { isServiceAvailable } from "@/lib/env";
import { deleteLocalFile } from "@/server/local-storage";
import { logInfo, logError } from "@/lib/logger";
import { appError } from "@/server/app-error";

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
      throw appError("NOT_FOUND", "errors.notFoundItems.file");
    }

    try {
      // Delete from storage
      if (isServiceAvailable("supabase-storage")) {
        const bucket = createSupabaseClient().storage.from("chatbot-files");
        const { data: removed, error: storageError } = await bucket.remove([
          file.storagePath,
        ]);

        // Stop before touching the database: deleting the row anyway would
        // leave the stored object with nothing pointing at it.
        if (storageError) {
          throw storageError;
        }

        // Storage reports success with nothing removed when the key lacks
        // delete rights, and every delete orphaned its file that way until
        // Oct 2026. Nothing removed is fine only if the file was already gone.
        if (removed.length === 0) {
          // Resolves false for a missing file; throws on any other failure.
          const { data: stillThere } = await bucket.exists(file.storagePath);
          if (stillThere) {
            throw new Error("Storage did not delete the file");
          }
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
      throw appError("INTERNAL_SERVER_ERROR", "files.toasts.deleteFailed");
    }
  });
