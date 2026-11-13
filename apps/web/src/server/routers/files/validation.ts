import { env } from "@/lib/env";
import { appError } from "@/server/app-error";

/**
 * Supported MIME types for file uploads
 */
export const SUPPORTED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
] as const;

/**
 * File extension to MIME type mapping
 */
export const EXTENSION_MIME_MAP: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  pptx: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  txt: ["text/plain"],
  md: ["text/markdown"],
  markdown: ["text/markdown"],
  json: ["application/json"],
  csv: ["text/csv"],
} as const;

/**
 * User-friendly file type names for error messages
 */
export const FILE_TYPE_DISPLAY_NAMES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "Word (.docx)",
  "application/msword": "Word (.doc)",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "PPTX",
  "text/plain": "Text",
  "text/markdown": "Markdown",
  "application/json": "JSON",
  "text/csv": "CSV",
};

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
    throw appError("BAD_REQUEST", "files.validation.nameInvalidCharacters");
  }

  // Check length
  if (fileName.length > 255) {
    throw appError("BAD_REQUEST", "files.validation.nameTooLong", { max: 255 });
  }
}

/**
 * Validates file size
 */
export function validateFileSize(fileSize: number): void {
  if (fileSize === 0) {
    throw appError("BAD_REQUEST", "files.upload.emptyFile");
  }

  const maxSizeMB = Number(env.NEXT_PUBLIC_MAX_FILE_SIZE_MB) || 50;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (fileSize > maxSizeBytes) {
    throw appError("BAD_REQUEST", "errors.files.tooLarge", {
      maxMb: maxSizeMB,
      sizeMb: Number((fileSize / 1024 / 1024).toFixed(2)),
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
    throw appError("BAD_REQUEST", "errors.files.unsupportedType", {
      type: displayName,
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
  const extension = fileNameLower.substring(fileNameLower.lastIndexOf(".") + 1);
  const validMimeTypes = EXTENSION_MIME_MAP[extension];

  if (extension && validMimeTypes && !validMimeTypes.includes(fileType)) {
    const displayName = FILE_TYPE_DISPLAY_NAMES[fileType] || fileType;
    throw appError("BAD_REQUEST", "errors.files.extensionMismatch", {
      extension,
      type: displayName,
    });
  }
}
