import { logWarn, logError } from "@teachanything/logger";

/** Canonical maximum image size accepted for OCR (shared across the app). */
export const OCR_MAX_IMAGE_SIZE_MB = 25;
export const OCR_MAX_IMAGE_SIZE_BYTES = OCR_MAX_IMAGE_SIZE_MB * 1024 * 1024;

/**
 * OCR and extraction configuration
 */
const OCR_CONFIG = {
  /** Max image size before rejecting (25MB) */
  MAX_IMAGE_BYTES: OCR_MAX_IMAGE_SIZE_BYTES,
  /** Multi-page PDFs below this extracted text length are likely scanned. */
  SCANNED_PDF_TEXT_THRESHOLD: 50,
  /** Individual fallback-rendered pages below this length are OCR candidates. */
  PDF_PAGE_OCR_TEXT_THRESHOLD: 10,
  /** Canvas render scale for PDF→image OCR (2x for quality) */
  PDF_RENDER_SCALE: 2,
  /** Avoid unbounded OCR work for huge scanned documents */
  MAX_PDF_OCR_PAGES: 30,
  /** Maximum rendered pixels per PDF page before downscaling */
  MAX_RENDERED_PAGE_PIXELS: 12_000_000,
  /** Lowest useful scale before a page is too large for reliable OCR */
  MIN_PDF_RENDER_SCALE: 0.75,
  /** Default OCR language. Tesseract language code(s), e.g. "eng", "eng+fra" */
  DEFAULT_OCR_LANGUAGE: "eng",
  /** Max ms to wait for Tesseract WASM worker to initialise (30s) */
  WORKER_INIT_TIMEOUT_MS: 30_000,
  /** Max ms to wait for a single OCR recognition call (45s) */
  RECOGNITION_TIMEOUT_MS: 45_000,
  /**
   * Cumulative OCR wall-clock budget across all pages of one extraction run.
   * This is the real cancellation bound, since tesseract.js ignores AbortSignal.
   */
  OCR_TOTAL_BUDGET_MS: 180_000,
} as const;

export type ExtractionStage = "ocr-page";

export interface ExtractionProgress {
  stage: ExtractionStage;
  currentPage: number;
  totalPages: number;
  percentage: number;
}

export type ExtractionProgressCallback = (
  progress: ExtractionProgress,
) => void | Promise<void>;

interface PdfParseResult {
  text?: string;
  numpages?: number;
}

interface PdfTextItem {
  str?: string;
}

interface PdfViewport {
  width: number;
  height: number;
}

interface PdfPage {
  getTextContent: () => Promise<{ items: PdfTextItem[] }>;
  getViewport: (opts: { scale: number }) => PdfViewport;
  render: (params: {
    canvasContext: unknown;
    canvas: unknown;
    viewport: PdfViewport;
  }) => { promise: Promise<void> };
  cleanup: () => void;
}

interface PdfDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() =>
    clearTimeout(timeoutId),
  );
}

/**
 * OCR / image / PDF-render service. Owns the tesseract.js worker lifecycle and
 * all decode-heavy extraction paths. RAGService delegates to this.
 */
export class OcrService {
  private ocrWorkerInitPromise: Promise<import("tesseract.js").Worker> | null =
    null;
  /** Cumulative OCR deadline (epoch ms) for the current extraction run. */
  private ocrDeadline: number | null = null;

  /**
   * Sanitize text to remove null bytes and control characters
   * PostgreSQL text fields cannot store null bytes (0x00)
   */
  private sanitizeText(text: string): string {
    return text
      .replace(/\0/g, "")
      .replace(/[\x01-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, " ")
      .trim();
  }

  /**
   * Extract text from PDF files, including the OCR fallback for scanned PDFs.
   */
  async extractPDF(
    buffer: Buffer,
    onProgress?: ExtractionProgressCallback,
    signal?: AbortSignal,
  ): Promise<string> {
    try {
      if (!Buffer.isBuffer(buffer)) {
        throw new Error("Invalid buffer: expected Buffer instance");
      }

      if (buffer.length === 0) {
        throw new Error("Empty buffer: cannot extract PDF from empty buffer");
      }

      const pdfHeader = buffer.subarray(0, 4).toString();
      if (pdfHeader !== "%PDF") {
        throw new Error(
          `Invalid PDF format: expected PDF header, got "${pdfHeader}"`,
        );
      }

      const parsed = await this.extractPDFText(buffer);
      if (!this.shouldUsePDFOCRFallback(parsed)) {
        if (!parsed.text) {
          throw new Error("PDF contains no readable text content");
        }
        return parsed.text;
      }

      return await this.extractPDFWithOCRFallback(
        buffer,
        parsed.text,
        onProgress,
        signal,
      );
    } catch (error) {
      logError(error, "PDF extraction error");
      throw new Error(
        `Failed to extract PDF content: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  private async extractPDFText(buffer: Buffer): Promise<{
    text: string;
    pageCount?: number;
  }> {
    const pdfParse = (await import("pdf-parse")).default as (
      input: Buffer,
    ) => Promise<PdfParseResult>;
    const data = await pdfParse(buffer);
    return {
      text: this.sanitizeText(data.text ?? ""),
      pageCount: data.numpages,
    };
  }

  private shouldUsePDFOCRFallback(parsed: {
    text: string;
    pageCount?: number;
  }): boolean {
    if (!parsed.text) {
      return true;
    }

    return (
      parsed.pageCount !== undefined &&
      parsed.pageCount > 1 &&
      parsed.text.length < OCR_CONFIG.SCANNED_PDF_TEXT_THRESHOLD
    );
  }

  private async loadPDFDocument(buffer: Buffer): Promise<PdfDocument> {
    const pdfjsLib =
      (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as {
        getDocument: (source: unknown) => { promise: Promise<PdfDocument> };
      };
    const { DOMMatrix, ImageData, Path2D } = await import("@napi-rs/canvas");

    const globals = globalThis as Record<
      "DOMMatrix" | "ImageData" | "Path2D",
      unknown
    >;
    globals.DOMMatrix ??= DOMMatrix;
    globals.ImageData ??= ImageData;
    globals.Path2D ??= Path2D;

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
    });
    return await loadingTask.promise;
  }

  private async extractPDFWithOCRFallback(
    buffer: Buffer,
    fallbackText: string,
    onProgress?: ExtractionProgressCallback,
    signal?: AbortSignal,
  ): Promise<string> {
    this.ocrDeadline = Date.now() + OCR_CONFIG.OCR_TOTAL_BUDGET_MS;
    const document = await this.loadPDFDocument(buffer);
    const pageTexts: string[] = [];
    let ocrPageCount = 0;

    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        if (signal?.aborted) throw signal.reason;

        await onProgress?.({
          stage: "ocr-page",
          currentPage: pageNumber,
          totalPages: document.numPages,
          percentage: ((pageNumber - 1) / document.numPages) * 100,
        });

        const page = await document.getPage(pageNumber);
        try {
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item) => item.str ?? "")
            .join(" ");
          const sanitizedText = this.sanitizeText(pageText);

          if (sanitizedText.length < OCR_CONFIG.PDF_PAGE_OCR_TEXT_THRESHOLD) {
            ocrPageCount++;
            if (ocrPageCount > OCR_CONFIG.MAX_PDF_OCR_PAGES) {
              throw new Error(
                `PDF has too many pages for OCR. Maximum supported scanned PDF length is ${OCR_CONFIG.MAX_PDF_OCR_PAGES} pages.`,
              );
            }

            const ocrText = await this.extractTextFromRenderedPDFPage(
              pageNumber,
              document.numPages,
              page,
              signal,
            );
            pageTexts.push(ocrText || sanitizedText);
          } else {
            pageTexts.push(sanitizedText);
          }
        } finally {
          page.cleanup();
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
        if (signal?.aborted) throw signal.reason;

        await onProgress?.({
          stage: "ocr-page",
          currentPage: pageNumber,
          totalPages: document.numPages,
          percentage: (pageNumber / document.numPages) * 100,
        });
      }
    } finally {
      await document.destroy();
      this.ocrDeadline = null;
    }

    const finalContent = this.sanitizeText(
      pageTexts.filter(Boolean).join("\n\n"),
    );
    if (!finalContent && fallbackText) {
      return fallbackText;
    }

    if (!finalContent) {
      throw new Error("PDF contains no readable text content");
    }

    return finalContent;
  }

  /**
   * Extract text from image files with OCR.
   */
  async extractTextFromImage(
    buffer: Buffer,
    mimeType?: string,
    signal?: AbortSignal,
  ): Promise<string> {
    if (signal?.aborted) throw signal.reason;
    this.validateImageBuffer(buffer, mimeType);

    const dimensions = this.probeImageDimensions(buffer, mimeType);
    if (dimensions === null) {
      throw new Error(
        "Invalid image format: unable to determine image dimensions",
      );
    }
    if (
      dimensions.width * dimensions.height >
      OCR_CONFIG.MAX_RENDERED_PAGE_PIXELS
    ) {
      throw new Error("Image dimensions exceed maximum limit for OCR");
    }

    const { loadImage } = await import("@napi-rs/canvas");
    try {
      const img = await loadImage(buffer);
      // Defensive secondary guard in case the header probe under-reported.
      if (img.width * img.height > OCR_CONFIG.MAX_RENDERED_PAGE_PIXELS) {
        throw new Error("Image dimensions exceed maximum limit for OCR");
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("dimensions exceed")
      ) {
        throw error;
      }
      throw new Error("Invalid image format: unable to decode image");
    }

    this.ocrDeadline = Date.now() + OCR_CONFIG.OCR_TOTAL_BUDGET_MS;
    try {
      const sanitizedText = await this.extractTextFromTrustedImage(
        buffer,
        signal,
      );

      if (!sanitizedText) {
        throw new Error("Image contains no readable text content");
      }

      return sanitizedText;
    } finally {
      this.ocrDeadline = null;
    }
  }

  private validateImageBuffer(buffer: Buffer, mimeType?: string): void {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error("Invalid buffer: expected Buffer instance");
    }

    if (buffer.length === 0) {
      throw new Error("Empty buffer: cannot extract image from empty buffer");
    }

    if (buffer.length > OCR_CONFIG.MAX_IMAGE_BYTES) {
      throw new Error(
        `Image exceeds OCR size limit of ${OCR_CONFIG.MAX_IMAGE_BYTES / 1024 / 1024}MB`,
      );
    }

    if (!mimeType) {
      return;
    }

    const detectedMimeType = this.detectImageMimeType(buffer);
    if (!detectedMimeType) {
      throw new Error("Invalid image format: unknown image header");
    }

    if (detectedMimeType !== mimeType) {
      throw new Error(
        `Invalid image format: expected ${mimeType}, got ${detectedMimeType}`,
      );
    }
  }

  private detectImageMimeType(buffer: Buffer): string | null {
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return "image/jpeg";
    }

    if (
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ) {
      return "image/png";
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
      return "image/webp";
    }

    if (
      buffer.length >= 4 &&
      ((buffer[0] === 0x49 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x2a &&
        buffer[3] === 0x00) ||
        (buffer[0] === 0x4d &&
          buffer[1] === 0x4d &&
          buffer[2] === 0x00 &&
          buffer[3] === 0x2a))
    ) {
      return "image/tiff";
    }

    return null;
  }

  /**
   * Read image dimensions directly from the file header WITHOUT fully decoding
   * the bitmap. Guards against decompression-bomb OOM before loadImage(). Returns
   * null if dimensions cannot be parsed (caller fails fast in that case).
   */
  private probeImageDimensions(
    buffer: Buffer,
    mimeType?: string,
  ): { width: number; height: number } | null {
    try {
      const detected = this.detectImageMimeType(buffer) ?? mimeType;
      switch (detected) {
        case "image/png":
          return this.probePng(buffer);
        case "image/jpeg":
          return this.probeJpeg(buffer);
        case "image/webp":
          return this.probeWebp(buffer);
        case "image/tiff":
          return this.probeTiff(buffer);
        default:
          return null;
      }
    } catch {
      // Any malformed-header RangeError etc. -> treat as unparseable.
      return null;
    }
  }

  private probePng(buffer: Buffer): { width: number; height: number } | null {
    // 8-byte signature, then IHDR: width @ offset 16, height @ offset 20.
    if (buffer.length < 24) return null;
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width <= 0 || height <= 0) return null;
    return { width, height };
  }

  private probeJpeg(buffer: Buffer): { width: number; height: number } | null {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1] ?? 0;
      const isSOF =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (isSOF) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        if (width <= 0 || height <= 0) return null;
        return { width, height };
      }
      // Skip this segment using its length field.
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (segmentLength < 2) return null;
      offset += 2 + segmentLength;
    }
    return null;
  }

  private probeWebp(buffer: Buffer): { width: number; height: number } | null {
    if (buffer.length < 30) return null;
    const fourcc = buffer.subarray(12, 16).toString("ascii");

    if (fourcc === "VP8 ") {
      // Lossy: 14-bit little-endian dimensions at offsets 26/28.
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      if (width <= 0 || height <= 0) return null;
      return { width, height };
    }

    if (fourcc === "VP8L") {
      // Lossless: bits packed from offset 21. b0..b3 are 4 bytes.
      if (buffer.length < 25) return null;
      const b1 = buffer[21] ?? 0;
      const b2 = buffer[22] ?? 0;
      const b3 = buffer[23] ?? 0;
      const b4 = buffer[24] ?? 0;
      const bits = b1 | (b2 << 8) | (b3 << 16) | (b4 << 24);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      return { width, height };
    }

    if (fourcc === "VP8X") {
      // Extended: 24-bit little-endian (width-1) @ 24, (height-1) @ 27.
      if (buffer.length < 30) return null;
      const width = (buffer.readUIntLE(24, 3) & 0xffffff) + 1;
      const height = (buffer.readUIntLE(27, 3) & 0xffffff) + 1;
      return { width, height };
    }

    return null;
  }

  private probeTiff(buffer: Buffer): { width: number; height: number } | null {
    if (buffer.length < 8) return null;
    const byteOrder = buffer.subarray(0, 2).toString("ascii");
    const little = byteOrder === "II";
    if (!little && byteOrder !== "MM") return null;

    const readU16 = (o: number) =>
      little ? buffer.readUInt16LE(o) : buffer.readUInt16BE(o);
    const readU32 = (o: number) =>
      little ? buffer.readUInt32LE(o) : buffer.readUInt32BE(o);

    const ifdOffset = readU32(4);
    if (ifdOffset + 2 > buffer.length) return null;
    const entryCount = readU16(ifdOffset);

    let width: number | null = null;
    let height: number | null = null;

    for (let i = 0; i < entryCount; i++) {
      const entryOffset = ifdOffset + 2 + i * 12;
      if (entryOffset + 12 > buffer.length) break;
      const tag = readU16(entryOffset);
      const type = readU16(entryOffset + 2);
      // type 3 = SHORT (uint16), type 4 = LONG (uint32)
      const value =
        type === 3 ? readU16(entryOffset + 8) : readU32(entryOffset + 8);
      if (tag === 0x0100) width = value;
      else if (tag === 0x0101) height = value;
    }

    if (width === null || height === null || width <= 0 || height <= 0) {
      return null;
    }
    return { width, height };
  }

  private async getOCRWorker(): Promise<import("tesseract.js").Worker> {
    if (!this.ocrWorkerInitPromise) {
      this.ocrWorkerInitPromise = (async () => {
        const { createWorker } = await import("tesseract.js");
        const { tmpdir } = await import("node:os");
        const { join } = await import("node:path");

        return withTimeout(
          createWorker(OCR_CONFIG.DEFAULT_OCR_LANGUAGE, 1, {
            logger: () => {},
            cachePath: join(tmpdir(), "tesseract-cache"),
          }),
          OCR_CONFIG.WORKER_INIT_TIMEOUT_MS,
          "OCR worker initialisation timed out",
        );
      })().catch((err) => {
        this.ocrWorkerInitPromise = null;
        throw err;
      });
    }
    return this.ocrWorkerInitPromise;
  }

  private async extractTextFromTrustedImage(
    buffer: Buffer,
    signal?: AbortSignal,
  ): Promise<string> {
    if (signal?.aborted) throw signal.reason;
    const worker = await this.getOCRWorker();

    const remaining =
      this.ocrDeadline === null
        ? OCR_CONFIG.RECOGNITION_TIMEOUT_MS
        : this.ocrDeadline - Date.now();
    if (remaining <= 0) throw new Error("OCR time budget exceeded");
    const perCallTimeout = Math.min(
      OCR_CONFIG.RECOGNITION_TIMEOUT_MS,
      remaining,
    );

    const result = await withTimeout(
      worker.recognize(buffer),
      perCallTimeout,
      "OCR recognition timed out",
    );
    if (signal?.aborted) throw signal.reason;

    const sanitizedText = this.sanitizeText(result.data.text);
    if (!sanitizedText) {
      throw new Error("Image contains no readable text content");
    }
    return sanitizedText;
  }

  private async extractTextFromRenderedPDFPage(
    pageNumber: number,
    totalPages: number,
    page: PdfPage,
    signal?: AbortSignal,
  ): Promise<string> {
    if (signal?.aborted) throw signal.reason;
    const { createCanvas } = await import("@napi-rs/canvas");

    let buffer: Buffer;
    try {
      const baseViewport = page.getViewport({ scale: 1 });
      const basePixelCount = baseViewport.width * baseViewport.height;
      if (basePixelCount <= 0) {
        throw new Error(`PDF page ${pageNumber} has invalid dimensions`);
      }

      const scale = Math.min(
        OCR_CONFIG.PDF_RENDER_SCALE,
        Math.sqrt(OCR_CONFIG.MAX_RENDERED_PAGE_PIXELS / basePixelCount),
      );

      if (scale < OCR_CONFIG.MIN_PDF_RENDER_SCALE) {
        throw new Error(
          `PDF page ${pageNumber} is too large to render for OCR`,
        );
      }

      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      const context = canvas.getContext("2d");

      await page.render({
        canvasContext: context,
        canvas,
        viewport,
      }).promise;

      buffer = canvas.toBuffer("image/png");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("too large to render for OCR")
      ) {
        throw error;
      }
      logWarn(
        `Failed to render PDF page ${pageNumber} of ${totalPages}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return "";
    }

    try {
      return await this.extractTextFromTrustedImage(buffer, signal);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Image contains no readable text content")
      ) {
        logWarn(
          `OCR found no text on PDF page ${pageNumber} (blank or image-only)`,
        );
        return "";
      }
      logWarn(
        `OCR failed on PDF page ${pageNumber} of ${totalPages}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return "";
    }
  }

  /**
   * Terminate the OCR worker and release its resources.
   */
  cleanup() {
    const workerPromise = this.ocrWorkerInitPromise;
    this.ocrWorkerInitPromise = null;
    if (workerPromise) {
      void workerPromise.then((w) => w.terminate()).catch(() => {});
    }
  }
}
