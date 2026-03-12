import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { userFiles } from "@teachanything/db/schema";
import { createSupabaseClient } from "@/lib/supabase";
import { isServiceAvailable } from "@/lib/env";
import {
  localFileExists,
  getLocalFileSize,
  deleteLocalFile,
} from "@/lib/local-storage";
import { publishQStashJob } from "@/lib/qstash";
import { env } from "@/lib/env";
import { logInfo, logError } from "@/lib/logger";
import { processFile } from "@/lib/file-processor";

/**
 * Finalize upload after client has uploaded to storage.
 * Creates database record and triggers file processing.
 * Supports both Supabase Storage and local filesystem.
 */
export const finalizeUploadProcedure = protectedProcedure
  .input(
    z.object({
      fileId: z.string().uuid({ error: "Invalid file ID format" }),
      fileName: z
        .string()
        .min(1, "File name is required")
        .max(255, "File name must be less than 255 characters"),
      fileType: z.string().min(1, "File type is required"),
      fileSize: z.number().positive("File size must be greater than 0"),
      storagePath: z.string().min(1, "Storage path is required"),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const isLocal = !isServiceAvailable("supabase-storage");

    /** Remove a file from whichever storage backend is active */
    async function cleanupFile(storagePath: string) {
      if (isLocal) {
        await deleteLocalFile(storagePath);
      } else {
        const supabase = createSupabaseClient();
        await supabase.storage.from("chatbot-files").remove([storagePath]);
      }
    }

    try {
      // Validate storage path matches expected pattern: {userId}/{fileId}
      const expectedPath = `${ctx.session.user.id}/${input.fileId}`;
      if (input.storagePath !== expectedPath) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid storage path",
        });
      }

      if (isLocal) {
        // Verify file exists on local filesystem
        const exists = await localFileExists(input.storagePath);
        if (!exists) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "File was not found in storage. Upload may have failed.",
          });
        }

        // Verify file size
        const actualSize = await getLocalFileSize(input.storagePath);
        const tolerance = input.fileSize * 0.01;
        if (Math.abs(actualSize - input.fileSize) > tolerance) {
          await cleanupFile(input.storagePath);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `File size mismatch. Expected ${input.fileSize} bytes, got ${actualSize} bytes. Upload may have been corrupted.`,
          });
        }
      } else {
        // Verify the file was actually uploaded to Supabase
        const supabase = createSupabaseClient();
        const { data: fileExists, error: checkError } = await supabase.storage
          .from("chatbot-files")
          .list(ctx.session.user.id, {
            limit: 1,
            search: input.fileId,
          });

        if (checkError || !fileExists || fileExists.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "File was not found in storage. Upload may have failed.",
          });
        }

        // Verify the uploaded file size matches what was declared
        const uploadedFile = fileExists[0];
        if (uploadedFile && uploadedFile.metadata?.size) {
          const actualSize = uploadedFile.metadata.size;
          const tolerance = input.fileSize * 0.01;
          if (Math.abs(actualSize - input.fileSize) > tolerance) {
            await cleanupFile(input.storagePath);
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `File size mismatch. Expected ${input.fileSize} bytes, got ${actualSize} bytes. Upload may have been corrupted.`,
            });
          }
        }
      }

      // Check for duplicate file name
      const existingFiles = await ctx.db
        .select()
        .from(userFiles)
        .where(
          and(
            eq(userFiles.userId, ctx.session.user.id),
            eq(userFiles.fileName, input.fileName),
          ),
        )
        .limit(1);

      if (existingFiles.length > 0) {
        await cleanupFile(input.storagePath);

        throw new TRPCError({
          code: "CONFLICT",
          message: `A file with the name "${input.fileName}" already exists. Please rename your file or delete the existing one.`,
        });
      }

      // Create file record in database
      const fileRecords = await ctx.db
        .insert(userFiles)
        .values({
          id: input.fileId,
          userId: ctx.session.user.id,
          fileName: input.fileName,
          fileType: input.fileType,
          fileSize: input.fileSize,
          storagePath: input.storagePath,
          processingStatus: "pending",
          metadata: {},
        })
        .returning();

      const fileRecord = fileRecords[0];

      if (!fileRecord) {
        await cleanupFile(input.storagePath);
        throw new Error("Failed to create file record");
      }

      // Process file
      if (env.NODE_ENV === "development") {
        logInfo("Processing file inline (development mode)", {
          fileId: fileRecord.id,
          userId: ctx.session.user.id,
          fileName: input.fileName,
        });

        // Process in background (don't await) to return response quickly
        processFile({
          fileId: fileRecord.id,
        }).catch((error) => {
          logError(error, "Inline file processing failed", {
            fileId: fileRecord.id,
            userId: ctx.session.user.id,
          });
        });
      } else {
        // Publish QStash job for async processing in production
        await publishQStashJob({
          url: `${env.NEXT_PUBLIC_APP_URL}/api/jobs/process-file`,
          body: {
            fileId: fileRecord.id,
          },
        });

        logInfo("File uploaded and processing job published", {
          fileId: fileRecord.id,
          userId: ctx.session.user.id,
          fileName: input.fileName,
        });
      }

      return {
        fileId: fileRecord.id,
        status: "pending" as const,
      };
    } catch (error) {
      logError(error, "File finalization failed", {
        userId: ctx.session.user.id,
        fileName: input.fileName,
        fileId: input.fileId,
      });

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to finalize file upload",
      });
    }
  });
