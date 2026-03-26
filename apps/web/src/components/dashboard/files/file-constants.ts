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
export const validateFileName = (fileName: string): string | null => {
  if (!fileName || fileName.trim().length === 0) {
    return "File name is required";
  }

  if (fileName.length > MAX_FILE_NAME_LENGTH) {
    return `File name must be less than ${MAX_FILE_NAME_LENGTH} characters`;
  }

  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*]/;
  // Check for control characters (0x00-0x1F) - check character codes directly
  const hasControlChars = Array.from(fileName).some(
    (char) => char.charCodeAt(0) >= 0 && char.charCodeAt(0) <= 31,
  );
  if (invalidChars.test(fileName) || hasControlChars) {
    return "File name contains invalid characters. Please use only letters, numbers, spaces, and common punctuation.";
  }

  // Check file extension
  const extension = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
  if (
    !ALLOWED_EXTENSIONS.includes(
      extension as (typeof ALLOWED_EXTENSIONS)[number],
    )
  ) {
    return `File extension ${extension} is not supported. Allowed extensions: ${ALLOWED_EXTENSIONS.join(", ")}`;
  }

  return null;
};

export const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

export const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString("en-US", {
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
