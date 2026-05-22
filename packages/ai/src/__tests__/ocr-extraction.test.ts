import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

interface TesseractResult {
  data: { text: string };
}

interface PdfParseResult {
  text: string;
  numpages: number;
}

interface PdfPage {
  getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: typeof renderMock;
  cleanup: () => void;
}

const recognizeMock = jest.fn<(buffer: Buffer) => Promise<TesseractResult>>();
const createWorkerMock = jest.fn<
  (
    language: string,
    oem: number,
    options: unknown,
  ) => Promise<{
    recognize: typeof recognizeMock;
    terminate: () => Promise<void>;
  }>
>();
const pdfParseMock = jest.fn<(buffer: Buffer) => Promise<PdfParseResult>>();
const renderMock = jest.fn<() => { promise: Promise<void> }>();
const getPageMock = jest.fn<(pageNumber: number) => Promise<PdfPage>>();
const destroyMock = jest.fn();
const getDocumentMock = jest.fn();
const createCanvasMock = jest.fn();
const loadImageMock =
  jest.fn<() => Promise<{ width: number; height: number }>>();

const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);

jest.unstable_mockModule("@teachanything/logger", () => ({
  logWarn: jest.fn(),
  logError: jest.fn(),
}));

jest.unstable_mockModule("tesseract.js", () => ({
  createWorker: createWorkerMock,
}));

jest.unstable_mockModule("pdf-parse", () => ({
  default: pdfParseMock,
}));

jest.unstable_mockModule("@napi-rs/canvas", () => ({
  DOMMatrix: class DOMMatrix {},
  ImageData: class ImageData {},
  Path2D: class Path2D {},
  createCanvas: createCanvasMock,
  loadImage: loadImageMock,
}));

jest.unstable_mockModule("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: getDocumentMock,
}));

const { RAGService } = await import("../rag-service");

describe("OCR extraction", () => {
  let service: InstanceType<typeof RAGService>;

  beforeEach(() => {
    service = new RAGService();
    recognizeMock.mockReset();
    createWorkerMock.mockReset();
    pdfParseMock.mockReset();
    renderMock.mockReset();
    getPageMock.mockReset();
    destroyMock.mockReset();
    getDocumentMock.mockReset();
    createCanvasMock.mockReset();
    loadImageMock.mockReset();

    createWorkerMock.mockResolvedValue({
      recognize: recognizeMock,
      terminate: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    });
    loadImageMock.mockResolvedValue({ width: 100, height: 100 });
    pdfParseMock.mockResolvedValue({ text: "  \n", numpages: 2 });
    getDocumentMock.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: getPageMock,
        destroy: destroyMock,
      }),
    });
    renderMock.mockReturnValue({ promise: Promise.resolve() });
    createCanvasMock.mockReturnValue({
      getContext: jest.fn(() => ({})),
      toBuffer: jest.fn(() => pngBuffer),
    });
    getPageMock.mockResolvedValue({
      getTextContent: jest.fn(() => Promise.resolve({ items: [] })),
      getViewport: jest.fn((opts: { scale: number }) => ({
        width: 100 * opts.scale,
        height: 200 * opts.scale,
      })),
      render: renderMock,
      cleanup: jest.fn(),
    });
  });

  afterEach(async () => {
    service.cleanup();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("extracts and sanitizes text from supported images", async () => {
    recognizeMock.mockResolvedValue({
      data: { text: " Lecture notes\0\nwith text " },
    });

    await expect(
      service.extractTextFromImage(pngBuffer, "image/png"),
    ).resolves.toBe("Lecture notes\nwith text");
    expect(recognizeMock).toHaveBeenCalledWith(pngBuffer);
  });

  it("creates the OCR worker with the default language", async () => {
    recognizeMock.mockResolvedValue({ data: { text: "text" } });
    await service.extractTextFromImage(pngBuffer, "image/png");
    expect(createWorkerMock).toHaveBeenCalledWith(
      "eng",
      1,
      expect.objectContaining({ logger: expect.any(Function) }),
    );
  });

  it("reuses the same worker across multiple calls", async () => {
    recognizeMock.mockResolvedValue({ data: { text: "text" } });
    await service.extractTextFromImage(pngBuffer, "image/png");
    await service.extractTextFromImage(pngBuffer, "image/png");
    expect(createWorkerMock).toHaveBeenCalledTimes(1);
  });

  it("rejects images whose header does not match the declared MIME type", async () => {
    await expect(
      service.extractTextFromImage(pngBuffer, "image/jpeg"),
    ).rejects.toThrow("Invalid image format: expected image/jpeg");
    expect(recognizeMock).not.toHaveBeenCalled();
  });

  it("surfaces OCR failures for images", async () => {
    recognizeMock.mockRejectedValue(new Error("OCR worker failed"));

    await expect(
      service.extractTextFromImage(pngBuffer, "image/png"),
    ).rejects.toThrow("OCR worker failed");
  });

  it("clears the worker init promise on failure so the next call retries", async () => {
    createWorkerMock
      .mockRejectedValueOnce(new Error("WASM load failed"))
      .mockResolvedValueOnce({
        recognize: recognizeMock,
        terminate: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      });
    recognizeMock.mockResolvedValue({ data: { text: "retry worked" } });

    await expect(
      service.extractTextFromImage(pngBuffer, "image/png"),
    ).rejects.toThrow("WASM load failed");

    await expect(
      service.extractTextFromImage(pngBuffer, "image/png"),
    ).resolves.toBe("retry worked");

    expect(createWorkerMock).toHaveBeenCalledTimes(2);
  });

  it("terminates the worker on cleanup even if init is still in flight", async () => {
    const terminateMock = jest
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined);
    let resolveWorker!: (w: {
      recognize: typeof recognizeMock;
      terminate: typeof terminateMock;
    }) => void;
    createWorkerMock.mockReturnValue(
      new Promise((resolve) => {
        resolveWorker = resolve;
      }),
    );

    const ocr = service.extractTextFromImage(pngBuffer, "image/png");
    await new Promise((resolve) => setTimeout(resolve, 0));
    service.cleanup();
    resolveWorker({ recognize: recognizeMock, terminate: terminateMock });

    await expect(ocr).rejects.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(terminateMock).toHaveBeenCalledTimes(1);
  });

  it("calls page.cleanup() after rendering each PDF page", async () => {
    recognizeMock.mockResolvedValue({ data: { text: "text" } });
    const pages = [
      {
        getTextContent: jest.fn(() => Promise.resolve({ items: [] })),
        getViewport: jest.fn((opts: { scale: number }) => ({
          width: 100 * opts.scale,
          height: 200 * opts.scale,
        })),
        render: renderMock,
        cleanup: jest.fn(),
      },
      {
        getTextContent: jest.fn(() => Promise.resolve({ items: [] })),
        getViewport: jest.fn((opts: { scale: number }) => ({
          width: 100 * opts.scale,
          height: 200 * opts.scale,
        })),
        render: renderMock,
        cleanup: jest.fn(),
      },
    ];
    getPageMock
      .mockResolvedValueOnce(pages[0] as PdfPage)
      .mockResolvedValueOnce(pages[1] as PdfPage);

    await service.extractContent(
      Buffer.from("%PDF-1.7 scanned"),
      "application/pdf",
    );

    for (const page of pages) {
      expect(page.cleanup).toHaveBeenCalledTimes(1);
    }
  });

  it("continues processing remaining pages when one page fails to render", async () => {
    recognizeMock.mockResolvedValueOnce({ data: { text: "page text" } });

    const cleanupMock = jest.fn();
    getPageMock
      .mockResolvedValueOnce({
        getTextContent: jest.fn(() => Promise.resolve({ items: [] })),
        getViewport: jest.fn(() => ({ width: 200, height: 400 })),
        render: jest.fn(() => ({
          promise: Promise.reject(new Error("render crash")),
        })),
        cleanup: cleanupMock,
      })
      .mockResolvedValueOnce({
        getTextContent: jest.fn(() => Promise.resolve({ items: [] })),
        getViewport: jest.fn((opts: { scale: number }) => ({
          width: 100 * opts.scale,
          height: 200 * opts.scale,
        })),
        render: renderMock,
        cleanup: cleanupMock,
      });

    const result = await service.extractContent(
      Buffer.from("%PDF-1.7 scanned"),
      "application/pdf",
    );

    expect(result).toBe("page text");
    expect(recognizeMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to OCR when PDF text extraction returns minimal text", async () => {
    recognizeMock
      .mockResolvedValueOnce({ data: { text: "Page one text" } })
      .mockResolvedValueOnce({ data: { text: "Page two text" } });

    const progressCalls: Array<{
      stage: "ocr-page";
      currentPage: number;
      totalPages: number;
      percentage: number;
    }> = [];
    const result = await service.extractContent(
      Buffer.from("%PDF-1.7 scanned"),
      "application/pdf",
      (progress) => {
        progressCalls.push(progress);
      },
    );

    expect(result).toBe("Page one text\n\nPage two text");
    expect(recognizeMock).toHaveBeenCalledTimes(2);
    expect(progressCalls).toContainEqual({
      stage: "ocr-page",
      currentPage: 1,
      totalPages: 2,
      percentage: 0,
    });
    expect(progressCalls).toContainEqual({
      stage: "ocr-page",
      currentPage: 2,
      totalPages: 2,
      percentage: 50,
    });
    expect(progressCalls).toContainEqual({
      stage: "ocr-page",
      currentPage: 2,
      totalPages: 2,
      percentage: 100,
    });
    const firstPage = (await getPageMock.mock.results[0]?.value) as
      | PdfPage
      | undefined;
    expect(firstPage?.getViewport).toHaveBeenCalledWith({ scale: 2 });
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });

  it("does not OCR PDFs with enough embedded text", async () => {
    pdfParseMock.mockResolvedValue({
      text: "Readable embedded PDF text. ".repeat(10),
      numpages: 1,
    });

    const result = await service.extractContent(
      Buffer.from("%PDF-1.7 text"),
      "application/pdf",
    );

    expect(result).toContain("Readable embedded PDF text");
    expect(recognizeMock).not.toHaveBeenCalled();
    expect(getDocumentMock).not.toHaveBeenCalled();
  });

  it("does not OCR single-page PDFs with substantial embedded text", async () => {
    pdfParseMock.mockResolvedValue({
      text: "A".repeat(200),
      numpages: 1,
    });

    const result = await service.extractContent(
      Buffer.from("%PDF-1.7 text"),
      "application/pdf",
    );

    expect(result).toBe("A".repeat(200));
    expect(recognizeMock).not.toHaveBeenCalled();
    expect(getDocumentMock).not.toHaveBeenCalled();
  });

  it("does not OCR short single-page PDFs with embedded text", async () => {
    pdfParseMock.mockResolvedValue({
      text: "Brief syllabus note.",
      numpages: 1,
    });

    const result = await service.extractContent(
      Buffer.from("%PDF-1.7 text"),
      "application/pdf",
    );

    expect(result).toBe("Brief syllabus note.");
    expect(recognizeMock).not.toHaveBeenCalled();
    expect(getDocumentMock).not.toHaveBeenCalled();
  });

  it("preserves embedded text when OCR fallback adds scanned page text", async () => {
    pdfParseMock.mockResolvedValue({
      text: "Readable page one text",
      numpages: 2,
    });
    recognizeMock.mockResolvedValueOnce({ data: { text: "Scanned page two" } });
    getPageMock
      .mockResolvedValueOnce({
        getTextContent: jest.fn(() =>
          Promise.resolve({ items: [{ str: "Readable page one text" }] }),
        ),
        getViewport: jest.fn((opts: { scale: number }) => ({
          width: 100 * opts.scale,
          height: 200 * opts.scale,
        })),
        render: renderMock,
        cleanup: jest.fn(),
      })
      .mockResolvedValueOnce({
        getTextContent: jest.fn(() => Promise.resolve({ items: [] })),
        getViewport: jest.fn((opts: { scale: number }) => ({
          width: 100 * opts.scale,
          height: 200 * opts.scale,
        })),
        render: renderMock,
        cleanup: jest.fn(),
      });

    const result = await service.extractContent(
      Buffer.from("%PDF-1.7 mixed"),
      "application/pdf",
    );

    expect(result).toBe("Readable page one text\n\nScanned page two");
  });

  it("uses embedded text when OCR fallback finds no additional text", async () => {
    pdfParseMock.mockResolvedValue({ text: "Page 1", numpages: 2 });
    recognizeMock
      .mockResolvedValueOnce({ data: { text: "   " } })
      .mockResolvedValueOnce({ data: { text: "   " } });

    await expect(
      service.extractContent(Buffer.from("%PDF-1.7 mixed"), "application/pdf"),
    ).resolves.toBe("Page 1");
  });

  it("does not apply the OCR page limit to long text PDFs", async () => {
    pdfParseMock.mockResolvedValue({
      text: "Readable embedded PDF text. ".repeat(20),
      numpages: 40,
    });

    await expect(
      service.extractContent(
        Buffer.from("%PDF-1.7 long-text"),
        "application/pdf",
      ),
    ).resolves.toContain("Readable embedded PDF text");
    expect(getDocumentMock).not.toHaveBeenCalled();
    expect(recognizeMock).not.toHaveBeenCalled();
  });

  it("rejects scanned PDFs above the OCR page limit", async () => {
    pdfParseMock.mockResolvedValue({ text: "  \n", numpages: 31 });
    getDocumentMock.mockReturnValue({
      promise: Promise.resolve({
        numPages: 31,
        getPage: getPageMock,
        destroy: destroyMock,
      }),
    });
    recognizeMock.mockResolvedValue({ data: { text: "page text" } });

    await expect(
      service.extractContent(Buffer.from("%PDF-1.7 huge"), "application/pdf"),
    ).rejects.toThrow("too many pages for OCR");
    expect(recognizeMock).toHaveBeenCalledTimes(30);
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });

  it("rejects PDF pages that are too large to render for OCR", async () => {
    pdfParseMock.mockResolvedValue({ text: "  \n", numpages: 1 });
    getDocumentMock.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: getPageMock,
        destroy: destroyMock,
      }),
    });
    getPageMock.mockResolvedValueOnce({
      getTextContent: jest.fn(() => Promise.resolve({ items: [] })),
      getViewport: jest.fn(() => ({
        width: 20_000,
        height: 20_000,
      })),
      render: renderMock,
      cleanup: jest.fn(),
    });

    await expect(
      service.extractContent(
        Buffer.from("%PDF-1.7 huge-page"),
        "application/pdf",
      ),
    ).rejects.toThrow("too large to render for OCR");
    expect(recognizeMock).not.toHaveBeenCalled();
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });
});
