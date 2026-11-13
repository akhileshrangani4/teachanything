import type { TFunction } from "i18next";
// Get max file size from environment variable (client-accessible via NEXT_PUBLIC_ prefix)
// Falls back to 50MB if not set
const getMaxFileSizeMB = (): number => {
  // Next.js replaces NEXT_PUBLIC_ vars at build time, accessible on both client and server
  return parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || "50", 10);
};

export const MAX_FILE_SIZE = getMaxFileSizeMB() * 1024 * 1024;
export const MAX_FILE_NAME_LENGTH = 255;
export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
] as const;

export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".pptx",
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".csv",
] as const;

// User-friendly file type names for error messages
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

// Helper to get user-friendly file type name
export const getFileTypeDisplayName = (mimeType: string): string => {
  return FILE_TYPE_DISPLAY_NAMES[mimeType] || mimeType;
};

// Validate file name
export const validateFileName = (
  fileName: string,
  t: TFunction,
): string | null => {
  if (!fileName || fileName.trim().length === 0) {
    return t("files.validation.nameRequired");
  }

  if (fileName.length > MAX_FILE_NAME_LENGTH) {
    return t("files.validation.nameTooLong", { max: MAX_FILE_NAME_LENGTH });
  }

  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*]/;
  // Check for control characters (0x00-0x1F) - check character codes directly
  const hasControlChars = Array.from(fileName).some(
    (char) => char.charCodeAt(0) >= 0 && char.charCodeAt(0) <= 31,
  );
  if (invalidChars.test(fileName) || hasControlChars) {
    return t("files.validation.nameInvalidCharacters");
  }

  // Check file extension
  const extension = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
  if (
    !ALLOWED_EXTENSIONS.includes(
      extension as (typeof ALLOWED_EXTENSIONS)[number],
    )
  ) {
    return t("files.validation.extensionNotSupported", {
      extension,
      allowed: ALLOWED_EXTENSIONS.join(", "),
    });
  }

  return null;
};

const FILE_SIZE_UNITS = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;

export const formatFileSize = (bytes: number, locale: string) => {
  const exponent =
    bytes === 0
      ? 0
      : Math.min(
          Math.floor(Math.log(bytes) / Math.log(1024)),
          FILE_SIZE_UNITS.length - 1,
        );
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: FILE_SIZE_UNITS[exponent],
    // Short bytes read wrongly in English: "500 byte".
    unitDisplay: exponent === 0 ? "long" : "short",
    maximumFractionDigits: 2,
  }).format(bytes / 1024 ** exponent);
};

export const formatDate = (date: Date | string, locale: string) => {
  return new Date(date).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "text-green-600";
    case "processing":
      return "text-blue-600";
    case "pending":
      return "text-yellow-600";
    case "failed":
      return "text-red-600";
    default:
      return "text-muted-foreground";
  }
};
