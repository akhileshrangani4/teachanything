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

/**
 * Header builders — produce minimal but byte-accurate image headers that the
 * `probeImageDimensions` helpers in ocr-service.ts can parse. Layouts mirror
 * those probe functions exactly.
 */
function makePngHeader(width: number, height: number): Buffer {
  // 8-byte signature, IHDR length (0x0000000D), "IHDR", width@16, height@20.
  const buf = Buffer.alloc(28);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(0x0000000d, 8); // IHDR chunk length
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  // 4 trailing bytes (bit depth, color type, etc.) keep length >= 24.
  return buf;
}

function makeJpegHeader(width: number, height: number): Buffer {
  // SOI (FF D8) + APP0 segment (FF E0, length 16) + SOF0 segment (FF C0).
  // probeJpeg scans for the SOF0 marker, then reads height@+5 and width@+7.
  const head = Buffer.alloc(20); // SOI(2) + APP0 marker(2) + len(2) + 14 bytes
  head[0] = 0xff;
  head[1] = 0xd8; // SOI
  head[2] = 0xff;
  head[3] = 0xe0; // APP0 marker
  head.writeUInt16BE(0x0010, 4); // APP0 segment length = 16 (covers offsets 4..19)
  head.write("JFIF\0", 6, "ascii");

  const sof = Buffer.alloc(11);
  sof[0] = 0xff;
  sof[1] = 0xc0; // SOF0
  sof.writeUInt16BE(0x0011, 2); // segment length = 17
  sof[4] = 0x08; // precision
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  sof[9] = 0x03; // component count
  sof[10] = 0x00;

  return Buffer.concat([head, sof]);
}

function makeWebpHeader(width: number, height: number): Buffer {
  // RIFF + size + WEBP + VP8X chunk; (w-1)@24 3-byte LE, (h-1)@27 3-byte LE.
  const buf = Buffer.alloc(30);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(buf.length - 8, 4);
  buf.write("WEBP", 8, "ascii");
  buf.write("VP8X", 12, "ascii");
  buf.writeUInt32LE(10, 16); // VP8X chunk size
  // flags byte @ 20, reserved 21-23
  buf.writeUIntLE(width - 1, 24, 3);
  buf.writeUIntLE(height - 1, 27, 3);
  return buf;
}

function makeTiffHeader(width: number, height: number): Buffer {
  // Little-endian TIFF: II 2A 00, IFD offset @ 4. IFD with ImageWidth/Length.
  const ifdOffset = 8;
  const entryCount = 2;
  const buf = Buffer.alloc(ifdOffset + 2 + entryCount * 12 + 4);
  buf.write("II", 0, "ascii");
  buf.writeUInt16LE(0x002a, 2);
  buf.writeUInt32LE(ifdOffset, 4);
  buf.writeUInt16LE(entryCount, ifdOffset);
  // Entry 0: ImageWidth (0x0100), type LONG (4), count 1, value.
  let e = ifdOffset + 2;
  buf.writeUInt16LE(0x0100, e);
  buf.writeUInt16LE(4, e + 2); // type LONG
  buf.writeUInt32LE(1, e + 4); // count
  buf.writeUInt32LE(width, e + 8);
  // Entry 1: ImageLength (0x0101), type LONG, count 1, value.
  e += 12;
  buf.writeUInt16LE(0x0101, e);
  buf.writeUInt16LE(4, e + 2);
  buf.writeUInt32LE(1, e + 4);
  buf.writeUInt32LE(height, e + 8);
  return buf;
}

// Parseable 10x10 PNG used by happy-path / blank-image tests.
const pngBuffer = makePngHeader(10, 10);

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
    loadImageMock.mockResolvedValue({ width: 10, height: 10 });
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
    ).rejects.toThrow(
      "Invalid image format: expected image/jpeg, got image/png",
    );
    expect(recognizeMock).not.toHaveBeenCalled();
  });

  it("rejects WEBP bytes declared as PNG", async () => {
    await expect(
      service.extractTextFromImage(makeWebpHeader(10, 10), "image/png"),
    ).rejects.toThrow(
      "Invalid image format: expected image/png, got image/webp",
    );
    expect(recognizeMock).not.toHaveBeenCalled();
  });

  it("rejects TIFF bytes declared as PNG", async () => {
    await expect(
      service.extractTextFromImage(makeTiffHeader(10, 10), "image/png"),
    ).rejects.toThrow(
      "Invalid image format: expected image/png, got image/tiff",
    );
    expect(recognizeMock).not.toHaveBeenCalled();
  });

  it("rejects JPEG bytes declared as PNG", async () => {
    await expect(
      service.extractTextFromImage(makeJpegHeader(10, 10), "image/png"),
    ).rejects.toThrow(
      "Invalid image format: expected image/png, got image/jpeg",
    );
    expect(recognizeMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown/garbage image header", async () => {
    const garbage = Buffer.from([
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
    ]);
    await expect(
      service.extractTextFromImage(garbage, "image/png"),
    ).rejects.toThrow("Invalid image format: unknown image header");
    expect(recognizeMock).not.toHaveBeenCalled();
  });

  it("surfaces OCR failures for images", async () => {
    recognizeMock.mockRejectedValue(new Error("OCR worker failed"));

    await expect(
      service.extractTextFromImage(pngBuffer, "image/png"),
    ).rejects.toThrow("OCR worker failed");
  });

  it("rejects images that contain no readable text", async () => {
    recognizeMock.mockResolvedValue({ data: { text: "   \n  " } });

    await expect(
      service.extractTextFromImage(pngBuffer, "image/png"),
    ).rejects.toThrow("Image contains no readable text content");
  });

  it("rejects images whose header dimensions exceed the OCR pixel limit", async () => {
    // 5000x5000 = 25M px > 12M cap; must fail before loadImage/recognize.
    await expect(
      service.extractTextFromImage(makePngHeader(5000, 5000), "image/png"),
    ).rejects.toThrow("Image dimensions exceed maximum limit for OCR");
    expect(loadImageMock).not.toHaveBeenCalled();
    expect(recognizeMock).not.toHaveBeenCalled();
  });

  it("rejects images whose dimensions cannot be parsed from the header", async () => {
    // Valid PNG magic bytes but truncated before the IHDR dimensions.
    const truncated = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    await expect(
      service.extractTextFromImage(truncated, "image/png"),
    ).rejects.toThrow(
      "Invalid image format: unable to determine image dimensions",
    );
    expect(loadImageMock).not.toHaveBeenCalled();
    expect(recognizeMock).not.toHaveBeenCalled();
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
    // Valid recognize result so the flow does not throw a spurious TypeError on
    // result.data.text — any resolution/rejection reflects real control flow.
    recognizeMock.mockResolvedValue({ data: { text: "text" } });
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
    // Cleanup while worker init is still pending: the worker reference is
    // detached and scheduled for termination once init settles.
    service.cleanup();
    resolveWorker({ recognize: recognizeMock, terminate: terminateMock });

    // cleanup() does NOT abort an in-flight call (no AbortSignal is wired into
    // extractTextFromImage's internal recognize path), so the already-captured
    // worker still completes recognition and the call resolves normally.
    await expect(ocr).resolves.toBe("text");
    await new Promise((r) => setTimeout(r, 0));
    // The detached worker is still terminated exactly once by cleanup().
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
