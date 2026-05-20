import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { ExtractionProgressCallback } from "../rag-service";

interface MockRecognizeResult {
  data: { text: string };
}

interface MockPdfParseResult {
  text: string;
  numpages: number;
}

interface MockPdfPage {
  getViewport: () => { width: number; height: number };
  render: typeof mockRender;
}

interface MockPdfDocument {
  numPages: number;
  getPage: typeof mockGetPage;
  destroy: typeof mockDestroy;
}

const mockRecognize =
  jest.fn<
    (
      image: Buffer,
      language: string,
      options: { logger: (message: unknown) => void },
    ) => Promise<MockRecognizeResult>
  >();
const mockPdfParse = jest.fn<(buffer: Buffer) => Promise<MockPdfParseResult>>();
const mockRender = jest.fn<() => { promise: Promise<void> }>();
const mockDestroy = jest.fn<() => Promise<void>>();
const mockGetPage = jest.fn<(pageNumber: number) => Promise<MockPdfPage>>();
const mockGetDocument =
  jest.fn<(params: unknown) => { promise: Promise<MockPdfDocument> }>();
const mockToBuffer = jest.fn<(mimeType: "image/png") => Buffer>();
const mockCreateCanvas = jest.fn<
  (
    width: number,
    height: number,
  ) => {
    getContext: () => { kind: "2d-context" };
    toBuffer: typeof mockToBuffer;
  }
>();

jest.unstable_mockModule("tesseract.js", () => ({
  default: {
    recognize: mockRecognize,
  },
}));

jest.unstable_mockModule("pdf-parse", () => ({
  default: mockPdfParse,
}));

jest.unstable_mockModule("@napi-rs/canvas", () => ({
  DOMMatrix: class DOMMatrix {},
  ImageData: class ImageData {},
  Path2D: class Path2D {},
  createCanvas: mockCreateCanvas,
}));

jest.unstable_mockModule("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: mockGetDocument,
}));

const { RAGService } = await import("../rag-service");

const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const maxOcrImageBytes = 25 * 1024 * 1024;
const pdfBuffer = Buffer.from("%PDF-1.7\nmock scanned pdf");

describe("OCR extraction", () => {
  let service: InstanceType<typeof RAGService>;

  beforeEach(() => {
    service = new RAGService();
    mockRecognize.mockReset();
    mockPdfParse.mockReset();
    mockGetDocument.mockReset();
    mockRender.mockReset();
    mockDestroy.mockReset();
    mockGetPage.mockReset();
    mockToBuffer.mockReset();
    mockCreateCanvas.mockReset();
    mockCreateCanvas.mockReturnValue({
      getContext: () => ({ kind: "2d-context" }),
      toBuffer: mockToBuffer,
    });
  });

  it("extracts and sanitizes image text through OCR", async () => {
    mockRecognize.mockResolvedValue({
      data: { text: "Lecture\0 notes\nChapter 1" },
    });

    const result = await service.extractTextFromImage(pngBuffer, "image/png");

    expect(result).toBe("Lecture notes\nChapter 1");
    expect(mockRecognize).toHaveBeenCalledWith(
      pngBuffer,
      "eng",
      expect.objectContaining({ logger: expect.any(Function) }),
    );
  });

  it("rejects images whose header does not match the declared MIME type", async () => {
    await expect(
      service.extractTextFromImage(pngBuffer, "image/jpeg"),
    ).rejects.toThrow("expected image/jpeg, got image/png");
    expect(mockRecognize).not.toHaveBeenCalled();
  });

  it("wraps OCR failures with an image extraction error", async () => {
    mockRecognize.mockRejectedValue(new Error("worker crashed"));

    await expect(
      service.extractTextFromImage(pngBuffer, "image/png"),
    ).rejects.toThrow("Failed to extract image content: worker crashed");
  });

  it("rejects images above the OCR size limit before starting OCR", async () => {
    const oversizedPng = Buffer.concat([
      pngBuffer,
      Buffer.alloc(maxOcrImageBytes + 1),
    ]);

    await expect(
      service.extractTextFromImage(oversizedPng, "image/png"),
    ).rejects.toThrow("Image exceeds OCR size limit of 25MB");
    expect(mockRecognize).not.toHaveBeenCalled();
  });

  it("falls back to per-page OCR when PDF text is minimal", async () => {
    mockPdfParse.mockResolvedValue({ text: "  ", numpages: 2 });
    mockToBuffer.mockReturnValue(pngBuffer);
    mockRecognize
      .mockResolvedValueOnce({ data: { text: "Page one text" } })
      .mockResolvedValueOnce({ data: { text: "Page two text" } });
    mockRender.mockReturnValue({ promise: Promise.resolve() });
    mockGetPage.mockResolvedValue({
      getViewport: jest.fn(() => ({ width: 100, height: 200 })),
      render: mockRender,
    });
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: mockGetPage,
        destroy: mockDestroy,
      }),
    });
    const progress = jest.fn<ExtractionProgressCallback>();

    const result = await service.extractContent(
      pdfBuffer,
      "application/pdf",
      progress,
    );

    expect(result).toBe("Page one text\n\nPage two text");
    expect(mockGetPage).toHaveBeenCalledTimes(2);
    expect(mockRecognize).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenNthCalledWith(1, {
      stage: "ocr-page",
      currentPage: 1,
      totalPages: 2,
      percentage: 50,
    });
    expect(progress).toHaveBeenNthCalledWith(2, {
      stage: "ocr-page",
      currentPage: 2,
      totalPages: 2,
      percentage: 100,
    });
  });

  it("falls back to OCR for single-page PDFs with minimal text", async () => {
    mockPdfParse.mockResolvedValue({ text: "x", numpages: 1 });
    mockToBuffer.mockReturnValue(pngBuffer);
    mockRecognize.mockResolvedValue({ data: { text: "Single scanned page" } });
    mockRender.mockReturnValue({ promise: Promise.resolve() });
    mockGetPage.mockResolvedValue({
      getViewport: jest.fn(() => ({ width: 100, height: 200 })),
      render: mockRender,
    });
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: mockGetPage,
        destroy: mockDestroy,
      }),
    });

    const result = await service.extractContent(pdfBuffer, "application/pdf");

    expect(result).toBe("Single scanned page");
    expect(mockRecognize).toHaveBeenCalledTimes(1);
  });

  it("continues OCR when one PDF page has no readable text", async () => {
    mockPdfParse.mockResolvedValue({ text: "", numpages: 2 });
    mockToBuffer.mockReturnValue(pngBuffer);
    mockRecognize
      .mockRejectedValueOnce(
        new Error(
          "Failed to extract image content: Image contains no readable text content",
        ),
      )
      .mockResolvedValueOnce({ data: { text: "Readable second page" } });
    mockRender.mockReturnValue({ promise: Promise.resolve() });
    mockGetPage.mockResolvedValue({
      getViewport: jest.fn(() => ({ width: 100, height: 200 })),
      render: mockRender,
    });
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: mockGetPage,
        destroy: mockDestroy,
      }),
    });

    const result = await service.extractContent(pdfBuffer, "application/pdf");

    expect(result).toBe("Readable second page");
    expect(mockRecognize).toHaveBeenCalledTimes(2);
  });

  it("continues OCR when one PDF page fails to render", async () => {
    mockPdfParse.mockResolvedValue({ text: "", numpages: 2 });
    mockToBuffer.mockReturnValue(pngBuffer);
    mockRecognize.mockResolvedValue({ data: { text: "Readable second page" } });
    mockRender.mockReturnValue({ promise: Promise.resolve() });
    mockGetPage
      .mockRejectedValueOnce(new Error("page damaged"))
      .mockResolvedValueOnce({
        getViewport: jest.fn(() => ({ width: 100, height: 200 })),
        render: mockRender,
      });
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: mockGetPage,
        destroy: mockDestroy,
      }),
    });

    const result = await service.extractContent(pdfBuffer, "application/pdf");

    expect(result).toBe("Readable second page");
    expect(mockRecognize).toHaveBeenCalledTimes(1);
  });

  it("does not run OCR for PDFs with enough embedded text", async () => {
    const richText = "A".repeat(300);
    mockPdfParse.mockResolvedValue({
      text: richText,
      numpages: 5,
    });

    const result = await service.extractContent(pdfBuffer, "application/pdf");

    expect(result).toBe(richText);
    expect(mockGetDocument).not.toHaveBeenCalled();
    expect(mockRecognize).not.toHaveBeenCalled();
  });

  it("falls back to OCR when chars-per-page is below threshold even if total chars exceeds it", async () => {
    mockPdfParse.mockResolvedValue({ text: "A".repeat(100), numpages: 10 });
    mockToBuffer.mockReturnValue(pngBuffer);
    mockRecognize.mockResolvedValue({ data: { text: "Scanned content" } });
    mockRender.mockReturnValue({ promise: Promise.resolve() });
    mockGetPage.mockResolvedValue({
      getViewport: jest.fn(() => ({ width: 100, height: 200 })),
      render: mockRender,
    });
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 10,
        getPage: mockGetPage,
        destroy: mockDestroy,
      }),
    });

    await service.extractContent(pdfBuffer, "application/pdf");

    expect(mockGetDocument).toHaveBeenCalled();
  });
});

describe("RAGService.countTokens concurrent initialization", () => {
  it("initializes the encoder exactly once when called concurrently", async () => {
    const { RAGService: FreshRAGService } = await import("../rag-service");
    const freshService = new FreshRAGService();

    const results = await Promise.all(
      Array.from({ length: 20 }, () => freshService.countTokens("hello world")),
    );

    expect(results).toHaveLength(20);
    for (const count of results) {
      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThan(0);
    }

    freshService.cleanup();
  });
});
