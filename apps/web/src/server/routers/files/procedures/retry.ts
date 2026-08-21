import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { userFiles, fileChunks } from "@teachanything/db/schema";
import { publishQStashJob } from "@/lib/qstash";
import { env } from "@/lib/env";
import { logInfo, logError } from "@/lib/logger";
import { processFile } from "@/lib/file-processor";

export const retryProcedure = protectedProcedure
  .input(
    z.object({
      fileId: z.string().uuid({ error: "Invalid file ID" }),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    try {
      // Get the file and verify ownership
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
          message: "File not found or you don't have permission to retry it",
        });
      }

      // Allow retry for failed, stuck, pending, or processing files
      // For processing files, this acts as a cancel + restart
      if (
        file.processingStatus !== "failed" &&
        file.processingStatus !== "pending" &&
        file.processingStatus !== "processing"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only retry failed, stuck, or processing files",
        });
      }

      // Delete existing chunks before retry to prevent stale accumulation
      await ctx.db
        .delete(fileChunks)
        .where(eq(fileChunks.fileId, input.fileId));

      logInfo("Cleared existing chunks for file retry", {
        fileId: input.fileId,
        userId: ctx.session.user.id,
      });

      // Reset file status to pending and clear error metadata.
      //
      // The progress stamp matters: `userFiles` has no `updatedAt`, so the
      // stale sweep dates a `pending` file from its last recorded activity,
      // falling back to `createdAt`. Clearing metadata outright would leave a
      // days-old upload looking like it had been queued days ago, and the
      // `files.list` refetch this mutation triggers would sweep it straight
      // back to `failed` before the job ever ran.
      const queuedAt = new Date().toISOString();
      await ctx.db
        .update(userFiles)
        .set({
          processingStatus: "pending",
          metadata: {
            processingProgress: {
              stage: "downloading",
              percentage: 0,
              startedAt: queuedAt,
              lastUpdatedAt: queuedAt,
            },
          },
        })
        .where(eq(userFiles.id, input.fileId));

      // Trigger processing again
      if (env.NODE_ENV === "development") {
        logInfo("Retrying file processing inline (development mode)", {
          fileId: input.fileId,
          userId: ctx.session.user.id,
          fileName: file.fileName,
        });

        // Process in background (don't await) to return response quickly
        processFile({
          fileId: input.fileId,
        }).catch((error) => {
          logError(error, "Retry file processing failed", {
            fileId: input.fileId,
            userId: ctx.session.user.id,
          });
        });
      } else {
        // Publish QStash job for async processing in production
        await publishQStashJob({
          url: `${env.NEXT_PUBLIC_APP_URL}/api/jobs/process-file`,
          body: {
            fileId: input.fileId,
          },
        });

        logInfo("File retry job published", {
          fileId: input.fileId,
          userId: ctx.session.user.id,
          fileName: file.fileName,
        });
      }

      return {
        success: true,
        message: "File processing restarted",
      };
    } catch (error) {
      logError(error, "File retry failed", {
        userId: ctx.session.user.id,
        fileId: input.fileId,
      });

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retry file processing",
      });
    }
  });
