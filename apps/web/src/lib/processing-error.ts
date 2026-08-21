/**
 * Owner-facing messages for a failed file-processing run.
 *
 * Split out from `file-processor.ts` so it can be tested without pulling in
 * the database, storage, and env singletons that module needs at import time.
 */

/** Shown when the upload is gone from storage but the row still exists. */
export const STORAGE_MISSING_ERROR =
  "The uploaded file could not be found in storage. Upload it again.";

/**
 * Turn an internal error into something the file owner can act on.
 *
 * The catch-all matters more than it looks: a professor who sees only "failed
 * due to an internal error" cannot tell a scanned PDF from a corrupt one from
 * an outage, so every failure looks like a platform bug and none of them get
 * reported usefully. Each branch below names a real, observed failure and says
 * what to do about it.
 */
export function sanitizeProcessingError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("timed out")) return "File processing timed out";
  if (msg.includes("Unsupported file type")) return msg;
  if (msg.includes("no readable text")) {
    // Overwhelmingly a scan or an image-only export: there is no text layer to
    // extract, and no amount of retrying will create one.
    return (
      "No readable text found. If this is a scanned document, it needs to be " +
      "run through OCR (or re-exported as a text PDF) before it can be used."
    );
  }
  if (msg.includes("Invalid PDF") || msg.includes("Empty buffer")) {
    return "This file is not a readable PDF -- it may be truncated or corrupt. Try re-exporting or re-downloading it.";
  }
  if (msg.includes("password") || msg.includes("encrypted")) {
    return "This file is password-protected. Remove the protection and upload it again.";
  }
  if (msg.includes("embedding") && msg.includes("dimension"))
    return "Embedding dimension mismatch";
  // Catch-alls keyed on OUR OWN wrapper text rather than on the parser's
  // internals. pdf.js reports structural damage a dozen different ways ("bad
  // XRef entry", "invalid top-level pages dictionary", ...) and that vocabulary
  // shifts between versions, but the wrapper messages thrown by
  // `RAGService.extract*` do not. Anything that failed inside extraction is,
  // from the file owner's point of view, a file that could not be read.
  if (msg.includes("Failed to extract PDF content")) {
    return "This PDF could not be read -- it may be damaged, truncated, or protected. Try re-saving or re-downloading it from the original source.";
  }
  if (
    msg.includes("Word document") ||
    msg.includes("Failed to extract Word document content")
  ) {
    return "This Word document could not be read. If it is an older .doc file, save it as .docx and upload again.";
  }
  if (msg.includes("Failed to extract content")) {
    return "This file could not be read. Try re-saving it in its native application and uploading again.";
  }
  return "File processing failed due to an internal error";
}
