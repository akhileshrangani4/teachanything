import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createSupabaseClient } from "@/lib/supabase";
import { checkRateLimit, fileUploadRateLimit } from "@/lib/rate-limit";
import { isServiceAvailable } from "@/lib/env";
import { userFiles } from "@teachanything/db/schema";
import {
  validateFileName,
  validateFileSize,
  validateFileType,
  validateExtensionMatchesMimeType,
} from "../validation";
import { randomUUID } from "crypto";

/**
 * Generate a signed upload URL for direct client-to-Supabase uploads
 * This bypasses API body size limits and provides better performance.
 *
 * When Supabase is not configured, returns a local upload URL instead.
 */
export const createUploadUrlProcedure = protectedProcedure
  .input(
    z.object({
      fileName: z
        .string()
        .min(1, "File name is required")
        .max(255, "File name must be less than 255 characters"),
      fileType: z.string().min(1, "File type is required"),
      fileSize: z.number().positive("File size must be greater than 0"),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // Rate limiting: 5 upload URL requests per minute per user
    const { success, reset } = await checkRateLimit(
      fileUploadRateLimit,
      ctx.session.user.id,
      {
        userId: ctx.session.user.id,
        fileName: input.fileName,
        endpoint: "createUploadUrl",
      },
    );

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Too many upload requests. Please try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
      });
    }

    // Validate file input
    validateFileName(input.fileName);
    validateFileSize(input.fileSize);
    validateFileType(input.fileType);
    validateExtensionMatchesMimeType(input.fileName, input.fileType);

    // Check for duplicate file name early (before generating signed URL)
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
      throw new TRPCError({
        code: "CONFLICT",
        message: `A file with the name "${input.fileName}" already exists. Please rename your file or delete the existing one.`,
      });
    }

    try {
      // Generate a unique UUID for the file
      const fileId = randomUUID();
      const storagePath = `${ctx.session.user.id}/${fileId}`;

      // Local filesystem mode when Supabase is not configured
      if (!isServiceAvailable("supabase-storage")) {
        return {
          uploadUrl: `/api/local-upload/${storagePath}`,
          fileId,
          storagePath,
          token: "local",
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        };
      }

      const supabase = createSupabaseClient();

      // Create a signed upload URL (expires in 15 minutes)
      const { data, error } = await supabase.storage
        .from("chatbot-files")
        .createSignedUploadUrl(storagePath);

      if (error || !data) {
        throw new Error(`Failed to create upload URL: ${error?.message}`);
      }

      return {
        uploadUrl: data.signedUrl,
        fileId,
        storagePath,
        token: data.token,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Failed to create upload URL",
      });
    }
  });
