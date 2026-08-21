import { describe, it, expect } from "@jest/globals";
import { sanitizeProcessingError } from "@/lib/processing-error";

/**
 * Every message a file owner can be shown when processing fails.
 *
 * The generic fallback is the reason the pdf-parse outage went undiagnosed:
 * "failed due to an internal error" is indistinguishable from a scanned PDF, a
 * corrupt upload, or a platform outage, so nothing actionable ever got reported.
 * Each case below is a failure observed running a real corpus through
 * `processFile`.
 */
describe("sanitizeProcessingError", () => {
  const cases: Array<[string, string, string]> = [
    [
      "scanned / image-only PDF",
      "PDF contains no readable text content",
      "OCR",
    ],
    [
      "empty upload",
      "Empty buffer: cannot extract PDF from empty buffer",
      "not a readable PDF",
    ],
    [
      "non-PDF renamed .pdf",
      'Invalid PDF format: expected PDF header, got "This"',
      "not a readable PDF",
    ],
    [
      "truncated PDF",
      'Invalid PDF format: expected PDF header, got "\\u0000"',
      "not a readable PDF",
    ],
    // pdf.js vocabulary varies by version; the wrapper text does not.
    [
      "structurally damaged PDF",
      "Failed to extract PDF content: invalid top-level pages dictionary",
      "could not be read",
    ],
    [
      "bad xref PDF",
      "Failed to extract PDF content: bad XRef entry",
      "could not be read",
    ],
    [
      "legacy .doc",
      "Failed to extract Word document content: Could not find file",
      ".docx",
    ],
    [
      "corrupt .docx",
      "Failed to extract Word document content: end of central directory",
      ".docx",
    ],
    [
      "word with no text",
      "Word document contains no readable text content",
      "OCR",
    ],
    [
      "password protected",
      "The file is encrypted and needs a password",
      "password-protected",
    ],
    [
      "unknown office file",
      "Failed to extract content: something went wrong",
      "could not be read",
    ],
    ["timeout", "File extraction timed out after 60s", "timed out"],
  ];

  it.each(cases)("%s explains what to do", (_label, raw, expected) => {
    const out = sanitizeProcessingError(new Error(raw));
    expect(out).toContain(expected);
    expect(out).not.toBe("File processing failed due to an internal error");
  });

  it("keeps the unsupported-type message the extractor already wrote", () => {
    const raw = "Unsupported file type: application/zip";
    expect(sanitizeProcessingError(new Error(raw))).toBe(raw);
  });

  it("still has a generic fallback for genuinely unknown failures", () => {
    expect(sanitizeProcessingError(new Error("ECONNRESET"))).toBe(
      "File processing failed due to an internal error",
    );
  });

  it("never leaks a stack trace or internal path to the user", () => {
    const raw =
      "Failed to extract PDF content: ENOENT: no such file or directory, open '/var/task/.next/server/chunks/x.js'";
    const out = sanitizeProcessingError(new Error(raw));
    expect(out).not.toContain("/var/task");
    expect(out).not.toContain("ENOENT");
  });
});
