/**
 * Magic-byte validation for uploaded files.
 *
 * Upload validation checks the declared MIME type against the file NAME
 * (`validateExtensionMatchesMimeType`), never against the contents, and the
 * client uploads straight to storage. So by the time a buffer reaches
 * extraction, nothing has confirmed the bytes are the type they claim to be.
 *
 * That matters because the extractors do not all trust the MIME type they were
 * handed. `parseOffice` in particular takes a Buffer with no filename, sniffs
 * the real type itself, and dispatches on that -- so PDF bytes uploaded as a
 * .pptx reach its PDF parser (pdfjs-dist) rather than the PowerPoint one.
 *
 * Checking the signature first keeps every buffer on the branch its MIME type
 * says it belongs to.
 */

/** Leading bytes that identify a container format. */
const PDF = [0x25, 0x50, 0x44, 0x46]; // %PDF
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04 -- every OOXML file
const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // legacy .doc/.xls/.ppt

const WORD_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const POWERPOINT_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/**
 * Signatures accepted per MIME type, with the name used in the error message.
 *
 * `application/msword` accepts both: a true legacy .doc is OLE2, and a .docx
 * renamed to .doc is a zip. Neither gets further than mammoth, which handles
 * OOXML only, but rejecting the zip here would fail uploads that work today.
 */
const SIGNATURES: Record<string, { bytes: number[][]; label: string }> = {
  "application/pdf": { bytes: [PDF], label: "PDF" },
  [WORD_MIME]: { bytes: [ZIP], label: "Word (.docx)" },
  "application/msword": { bytes: [ZIP, OLE2], label: "Word" },
  [POWERPOINT_MIME]: { bytes: [ZIP], label: "PowerPoint (.pptx)" },
};

/**
 * Binary containers a text file must not be. Text formats have no signature of
 * their own, so the check runs the other way: reject anything that is clearly
 * one of the binary types instead of demanding a marker text files never carry.
 *
 * Deliberately not a general "is this binary?" test. Extraction already strips
 * control characters, and a file that is merely odd should keep working.
 */
const TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

const BINARY_CONTAINERS: Array<{ bytes: number[]; label: string }> = [
  { bytes: PDF, label: "a PDF" },
  { bytes: ZIP, label: "a zip or Office document" },
  { bytes: OLE2, label: "a legacy Office document" },
];

function startsWith(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, i) => buffer[i] === byte);
}

/**
 * Throws when the buffer's leading bytes do not match its declared MIME type.
 * Returns normally for a type with no signature to check.
 */
export function assertFileSignature(buffer: Buffer, mimeType: string): void {
  if (buffer.length === 0) {
    // `sanitizeProcessingError` keys on this wording, see
    // apps/web/src/lib/processing-error.ts.
    throw new Error("Empty file: the upload has no content");
  }

  const expected = SIGNATURES[mimeType];

  if (expected) {
    if (!expected.bytes.some((signature) => startsWith(buffer, signature))) {
      throw new Error(
        `Invalid ${expected.label} file: the contents do not match the file type. This may indicate a renamed or corrupted file.`,
      );
    }
    return;
  }

  if (TEXT_MIMES.has(mimeType)) {
    const container = BINARY_CONTAINERS.find((c) =>
      startsWith(buffer, c.bytes),
    );

    if (container) {
      throw new Error(
        `Invalid text file: the contents are ${container.label}, so they do not match the file type. This may indicate a renamed or corrupted file.`,
      );
    }
  }
}
