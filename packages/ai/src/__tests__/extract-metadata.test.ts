import {
  jest,
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "@jest/globals";

/**
 * extractAndChunkWithMetadata is the seam the visual-material pipeline hangs
 * on: it must hand back the PDF's reported page count even when the text layer
 * is empty (that is the scanned-PDF case the vision model then reads), and
 * extractContent must keep rejecting a text-less PDF through the same wrapper.
 */
const mockPdfParse =
  jest.fn<(buffer: Buffer) => Promise<{ text: string; numpages?: number }>>();

jest.unstable_mockModule("pdf-parse/lib/pdf-parse.js", () => ({
  default: mockPdfParse,
}));

const { RAGService } = await import("../rag-service");

const service = new RAGService();
const pdf = (body = "body") => Buffer.from(`%PDF-1.7\n${body}`);

beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  mockPdfParse.mockReset();
});

describe("extractAndChunkWithMetadata", () => {
  it("returns paged chunks plus the reported page count", async () => {
    mockPdfParse.mockResolvedValue({
      text: "page one\fpage two",
      numpages: 2,
    });

    const result = await service.extractAndChunkWithMetadata(
      pdf(),
      "application/pdf",
    );

    expect(result.pageCount).toBe(2);
    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[0]!.pageNumber).toBe(1);
    expect(result.chunks[1]!.pageNumber).toBe(2);
  });

  it("returns an empty result for a scanned PDF with no text layer", async () => {
    mockPdfParse.mockResolvedValue({ text: "", numpages: 7 });

    const result = await service.extractAndChunkWithMetadata(
      pdf(),
      "application/pdf",
    );

    expect(result).toEqual({ chunks: [], pageCount: 7 });
  });

  it("chunks non-PDF content without page metadata", async () => {
    const result = await service.extractAndChunkWithMetadata(
      Buffer.from("Hello world, this is plain text."),
      "text/plain",
    );

    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]!.pageNumber).toBeUndefined();
    expect(result.pageCount).toBeUndefined();
  });

  it("rejects a PDF whose parser returns no usable result", async () => {
    mockPdfParse.mockResolvedValue(null as never);

    await expect(
      service.extractAndChunkWithMetadata(pdf(), "application/pdf"),
    ).rejects.toThrow(/PDF parsing returned an invalid result/);
  });

  it("extractAndChunk returns just the chunks", async () => {
    mockPdfParse.mockResolvedValue({
      text: "page one\fpage two",
      numpages: 2,
    });

    const chunks = await service.extractAndChunk(pdf(), "application/pdf");

    expect(chunks).toHaveLength(2);
  });
});

describe("extractContent on a text-less PDF", () => {
  it("rejects through the shared extraction-failure wrapper", async () => {
    mockPdfParse.mockResolvedValue({ text: "", numpages: 3 });

    await expect(
      service.extractContent(pdf(), "application/pdf"),
    ).rejects.toThrow(/Failed to extract PDF content.*no readable text/);
  });
});
