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
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const GIF87A = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
const GIF89A = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];

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
  "image/png": { bytes: [PNG], label: "PNG image" },
  "image/jpeg": { bytes: [JPEG], label: "JPEG image" },
  "image/gif": { bytes: [GIF87A, GIF89A], label: "GIF image" },
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
  { bytes: PNG, label: "a PNG image" },
  { bytes: JPEG, label: "a JPEG image" },
  { bytes: GIF87A, label: "a GIF image" },
  { bytes: GIF89A, label: "a GIF image" },
];

function startsWith(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, i) => buffer[i] === byte);
}

function isWebP(buffer: Buffer): boolean {
  return (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

/** GIF frame counter that walks blocks rather than matching image bytes inside compressed data. */
function countGifFrames(buffer: Buffer): number {
  if (buffer.length < 13) return 0;
  const packed = buffer[10] ?? 0;
  let offset = 13;
  if ((packed & 0x80) !== 0) {
    offset += 3 * 2 ** ((packed & 0x07) + 1);
  }

  let frames = 0;
  const skipSubBlocks = () => {
    while (offset < buffer.length) {
      const length = buffer[offset++] ?? 0;
      if (length === 0) break;
      offset += length;
    }
  };

  while (offset < buffer.length) {
    const marker = buffer[offset++] ?? 0;
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      offset += 1;
      skipSubBlocks();
      continue;
    }
    if (marker !== 0x2c || offset + 9 > buffer.length) break;

    frames += 1;
    const descriptorPacked = buffer[offset + 8] ?? 0;
    offset += 9;
    if ((descriptorPacked & 0x80) !== 0) {
      offset += 3 * 2 ** ((descriptorPacked & 0x07) + 1);
    }
    offset += 1;
    skipSubBlocks();
  }

  return frames;
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

  if (mimeType === "image/webp") {
    if (!isWebP(buffer)) {
      throw new Error(
        "Invalid WebP image file: the contents do not match the file type. This may indicate a renamed or corrupted file.",
      );
    }
    if (buffer.includes(Buffer.from("ANIM", "ascii"))) {
      throw new Error("Animated WebP images are not supported.");
    }
    return;
  }

  const expected = SIGNATURES[mimeType];

  if (expected) {
    if (!expected.bytes.some((signature) => startsWith(buffer, signature))) {
      throw new Error(
        `Invalid ${expected.label} file: the contents do not match the file type. This may indicate a renamed or corrupted file.`,
      );
    }
    if (mimeType === "image/gif" && countGifFrames(buffer) > 1) {
      throw new Error("Animated GIF images are not supported.");
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
