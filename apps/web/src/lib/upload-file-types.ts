export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
] as const;

export type AllowedFileType = (typeof ALLOWED_FILE_TYPES)[number];

export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".pptx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".tiff",
  ".tif",
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".csv",
] as const;

export const FILE_INPUT_ACCEPT = ALLOWED_EXTENSIONS.join(",");

export const OCR_MAX_IMAGE_SIZE_MB = 25;
export const OCR_MAX_IMAGE_SIZE_BYTES = OCR_MAX_IMAGE_SIZE_MB * 1024 * 1024;

export const OCR_IMAGE_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
] as const;

export const EXTENSION_TO_FILE_TYPE: Record<string, AllowedFileType> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".json": "application/json",
  ".csv": "text/csv",
};

export const FILE_TYPE_DISPLAY_NAMES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "Word (.docx)",
  "application/msword": "Word (.doc)",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "PPTX",
  "image/jpeg": "JPEG image",
  "image/png": "PNG image",
  "image/webp": "WEBP image",
  "image/tiff": "TIFF image",
  "text/plain": "Text",
  "text/markdown": "Markdown",
  "application/json": "JSON",
  "text/csv": "CSV",
};

export function getFileExtension(fileName: string): string | null {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === fileName.length - 1) {
    return null;
  }
  return fileName.slice(lastDot).toLowerCase();
}

export function inferSupportedFileType(
  fileName: string,
  declaredType: string,
): string {
  const extension = getFileExtension(fileName);
  const extensionType = extension ? EXTENSION_TO_FILE_TYPE[extension] : null;

  if (
    extensionType &&
    (!declaredType ||
      declaredType === "application/octet-stream" ||
      (declaredType === "text/plain" && extensionType !== "text/plain"))
  ) {
    return extensionType;
  }

  if (ALLOWED_FILE_TYPES.includes(declaredType as AllowedFileType)) {
    return declaredType;
  }

  return extensionType ?? declaredType;
}

export function isOCRImageFileType(fileType: string): boolean {
  return OCR_IMAGE_FILE_TYPES.includes(
    fileType as (typeof OCR_IMAGE_FILE_TYPES)[number],
  );
}
