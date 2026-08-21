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
    // pdf.js's PasswordException wording, wrapped by RAGService.extractPDF.
    // "Incorrect Password" is capitalized, which a substring match missed.
    [
      "encrypted PDF, no password supplied",
      "Failed to extract PDF content: No password given",
      "password-protected",
    ],
    [
      "encrypted PDF, wrong password",
      "Failed to extract PDF content: Incorrect Password",
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

  it("names an embedding dimension mismatch", () => {
    expect(
      sanitizeProcessingError(
        new Error("embedding returned dimension 3072, expected 1536"),
      ),
    ).toBe("Embedding dimension mismatch");
  });

  it("handles a thrown non-Error without losing the message", () => {
    // Anything can be thrown; the classifier reads whatever String() gives it.
    expect(sanitizeProcessingError("File extraction timed out")).toBe(
      "File processing timed out",
    );
    expect(sanitizeProcessingError({ code: 500 })).toBe(
      "File processing failed due to an internal error",
    );
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

  it("does not read a password hint out of an unrelated word", () => {
    // The match is word-bounded, so a message that merely contains the letters
    // is not turned into "remove the protection and upload it again".
    expect(
      sanitizeProcessingError(new Error("upstream returned passwordless=true")),
    ).toBe("File processing failed due to an internal error");
  });

  it("never leaks a stack trace or internal path to the user", () => {
    const raw =
      "Failed to extract PDF content: ENOENT: no such file or directory, open '/var/task/.next/server/chunks/x.js'";
    const out = sanitizeProcessingError(new Error(raw));
    expect(out).not.toContain("/var/task");
    expect(out).not.toContain("ENOENT");
  });
});

/**
 * The failure mode that hits every file at once, and the one the generic
 * catch-all served worst.
 */
describe("sanitizeProcessingError on provider failures", () => {
  it("names an exhausted API balance as a platform problem", () => {
    // Verified live against the real API while the balance was empty.
    const out = sanitizeProcessingError(
      new Error(
        "You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.",
      ),
    );
    expect(out).toContain("out of quota");
    expect(out).toContain("not a problem with your file");
    expect(out).not.toBe("File processing failed due to an internal error");
  });

  it("names a rejected key without leaking it", () => {
    // Verified live: OpenAI masks the key itself, but the prefix still appears.
    const out = sanitizeProcessingError(
      new Error(
        "Incorrect API key provided: sk-proj-****************************0000. You can find your API key at https://platform.openai.com/account/api-keys.",
      ),
    );
    expect(out).toContain("key was rejected");
    expect(out).not.toContain("sk-proj");
  });

  it("tells the owner to wait when the provider was merely busy", () => {
    const out = sanitizeProcessingError(
      new Error("API error: 503 Service Unavailable"),
    );
    expect(out).toContain("Try again in a few minutes");
  });

  it("still classifies a parser error that happens to contain a status number", () => {
    // Provider checks run last for exactly this reason: pdf.js messages carry
    // object numbers, and an early status match would relabel a corrupt file as
    // an outage.
    const out = sanitizeProcessingError(
      new Error("Failed to extract PDF content: bad object 500 in XRef"),
    );
    expect(out).toContain("could not be read");
    expect(out).not.toContain("AI service");
  });
});
