import { TRPCError } from "@trpc/server";
import { env } from "@/lib/env";
import {
  ALLOWED_FILE_TYPES,
  EXTENSION_TO_FILE_TYPE,
  FILE_TYPE_DISPLAY_NAMES,
  OCR_MAX_IMAGE_SIZE_MB,
  OCR_MAX_IMAGE_SIZE_BYTES,
  isOCRImageFileType,
} from "@/lib/upload-file-types";

/**
 * Supported MIME types for file uploads
 */
export const SUPPORTED_FILE_TYPES = ALLOWED_FILE_TYPES;

/**
 * File extension to MIME type mapping
 */
export const EXTENSION_MIME_MAP: Record<string, string[]> = Object.fromEntries(
  Object.entries(EXTENSION_TO_FILE_TYPE).map(([extension, mimeType]) => [
    extension.slice(1),
    [mimeType],
  ]),
);

/**
 * User-friendly file type names for error messages
 */
export { FILE_TYPE_DISPLAY_NAMES };

/**
 * Validates file name for invalid characters and length
 */
export function validateFileName(fileName: string): void {
  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*]/;
  const hasControlChars = Array.from(fileName).some(
    (char) => char.charCodeAt(0) >= 0 && char.charCodeAt(0) <= 31,
  );

  if (invalidChars.test(fileName) || hasControlChars) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "File name contains invalid characters. Please use only letters, numbers, spaces, and common punctuation.",
    });
  }

  // Check length
  if (fileName.length > 255) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "File name must be less than 255 characters",
    });
  }
}

/**
 * Validates file size
 */
export function validateFileSize(fileSize: number, fileType?: string): void {
  if (fileSize === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cannot upload empty file",
    });
  }

  const maxSizeMB = Number(env.NEXT_PUBLIC_MAX_FILE_SIZE_MB) || 50;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (fileSize > maxSizeBytes) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `File size exceeds ${maxSizeMB}MB limit. Current file size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`,
    });
  }

  if (fileType && isOCRImageFileType(fileType)) {
    validateOCRImageFileSize(fileSize);
  }
}

export function validateOCRImageFileSize(fileSize: number): void {
  if (fileSize > OCR_MAX_IMAGE_SIZE_BYTES) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Image file size exceeds the ${OCR_MAX_IMAGE_SIZE_MB}MB OCR processing limit. Please compress the image or upload a smaller file.`,
    });
  }
}

/**
 * Validates file type against supported types
 */
export function validateFileType(fileType: string): void {
  if (
    !SUPPORTED_FILE_TYPES.includes(
      fileType as (typeof SUPPORTED_FILE_TYPES)[number],
    )
  ) {
    const displayName = FILE_TYPE_DISPLAY_NAMES[fileType] || fileType;
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Unsupported file type: ${displayName}. Supported types: PDF, Word (.doc, .docx), PowerPoint (.pptx), Images (JPG, PNG, WEBP, TIFF), Text, Markdown, JSON, CSV`,
    });
  }
}

/**
 * Validates that file extension matches the declared MIME type
 * This prevents file type spoofing attacks
 */
export function validateExtensionMatchesMimeType(
  fileName: string,
  fileType: string,
): void {
  const fileNameLower = fileName.toLowerCase();
  const lastDot = fileNameLower.lastIndexOf(".");
  const extension = lastDot >= 0 ? fileNameLower.substring(lastDot + 1) : "";
  const validMimeTypes = EXTENSION_MIME_MAP[extension];

  if (!extension || !validMimeTypes) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `File extension${extension ? ` (.${extension})` : ""} is not supported.`,
    });
  }

  if (!validMimeTypes.includes(fileType)) {
    const displayName = FILE_TYPE_DISPLAY_NAMES[fileType] || fileType;
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `File extension (.${extension}) does not match file type (${displayName}). This may indicate a renamed or corrupted file.`,
    });
  }
}
