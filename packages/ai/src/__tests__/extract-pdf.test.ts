import { jest, describe, it, expect, beforeEach } from "@jest/globals";

/**
 * Mock the IMPLEMENTATION subpath, not the package root.
 *
 * That is the whole point of the fix under test: pdf-parse@1.1.1's index.js
 * runs `!module.parent` debug code at import time, which under ESM tries to
 * read a fixture relative to the process CWD and throws ENOENT before touching
 * the upload. `extractPDF` imports `pdf-parse/lib/pdf-parse.js` to skip it.
 *
 * Because this mock is keyed to that exact specifier, it only intercepts if the
 * production code still uses it -- so a revert to `import("pdf-parse")` makes
 * these tests load the real (crashing) module rather than passing quietly.
 */
const mockPdfParse = jest.fn<(buffer: Buffer) => Promise<{ text: string }>>();

jest.unstable_mockModule("pdf-parse/lib/pdf-parse.js", () => ({
  default: mockPdfParse,
}));

const { RAGService } = await import("../rag-service");

const service = new RAGService({ openaiApiKey: "test-key" });
const pdf = (body = "body") => Buffer.from(`%PDF-1.7\n${body}`);
const extract = (buffer: Buffer) =>
  service.extractContent(buffer, "application/pdf");

describe("RAGService PDF extraction", () => {
  beforeEach(() => {
    mockPdfParse.mockReset();
  });

  it("parses through the implementation subpath", async () => {
    mockPdfParse.mockResolvedValue({ text: "Photosynthesis converts light." });

    await expect(extract(pdf())).resolves.toBe(
      "Photosynthesis converts light.",
    );
    expect(mockPdfParse).toHaveBeenCalledTimes(1);
    // The buffer is handed over untouched; pdf-parse accepts Buffers.
    expect(Buffer.isBuffer(mockPdfParse.mock.calls[0]![0])).toBe(true);
  });

  it("keeps form feeds so page-aware chunking still sees page breaks", async () => {
    mockPdfParse.mockResolvedValue({ text: "page one\fpage two" });

    await expect(extract(pdf())).resolves.toBe("page one\fpage two");
  });

  it("rejects an empty upload before reaching the parser", async () => {
    await expect(extract(Buffer.alloc(0))).rejects.toThrow("Empty buffer");
    expect(mockPdfParse).not.toHaveBeenCalled();
  });

  it("rejects a non-PDF renamed .pdf before reaching the parser", async () => {
    await expect(extract(Buffer.from("This is a text file"))).rejects.toThrow(
      "Invalid PDF format",
    );
    expect(mockPdfParse).not.toHaveBeenCalled();
  });

  it("wraps a parser failure in the message the sanitizer keys on", async () => {
    // `sanitizeProcessingError` matches this wrapper text rather than pdf.js's
    // own vocabulary, which shifts between versions.
    mockPdfParse.mockRejectedValue(new Error("bad XRef entry"));

    await expect(extract(pdf())).rejects.toThrow(
      "Failed to extract PDF content: bad XRef entry",
    );
  });

  it("surfaces an encrypted PDF as a password failure", async () => {
    mockPdfParse.mockRejectedValue(new Error("No password given"));

    await expect(extract(pdf())).rejects.toThrow("No password given");
  });

  it("reports a scanned PDF as having no readable text", async () => {
    // A text layer of nothing but whitespace is what an image-only export looks
    // like once sanitized.
    mockPdfParse.mockResolvedValue({ text: "  " });

    await expect(extract(pdf())).rejects.toThrow(
      "PDF contains no readable text content",
    );
  });

  it("reports a parser that returns no text at all", async () => {
    mockPdfParse.mockResolvedValue({ text: "" });

    await expect(extract(pdf())).rejects.toThrow(
      "Failed to extract PDF content",
    );
  });
});
