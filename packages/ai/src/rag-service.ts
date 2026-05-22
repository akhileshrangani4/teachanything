import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { logWarn, logError } from "@teachanything/logger";
import type { OpenRouterClient } from "./openrouter-client";
import { CHARS_PER_TOKEN } from "./token-budget";

/**
 * OCR and extraction configuration
 */
const OCR_CONFIG = {
  /** Max image size before rejecting (25MB) */
  MAX_IMAGE_BYTES: 25 * 1024 * 1024,
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
  /** Max ms to wait for a single OCR recognition call (2m) */
  RECOGNITION_TIMEOUT_MS: 120_000,
} as const;

type ExtractionStage = "ocr-page";

export interface ExtractionProgress {
  stage: ExtractionStage;
  currentPage: number;
  totalPages: number;
  percentage: number;
}

export type ExtractionProgressCallback = (
  progress: ExtractionProgress,
) => void | Promise<void>;

/** Recursive node type for officeparser AST */
interface OfficeparserNode {
  text?: string;
  children?: OfficeparserNode[];
}

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

/**
 * RAG Service for file processing, chunking, and semantic search
 */
export class RAGService {
  private textSplitter: RecursiveCharacterTextSplitter;
  private encoder: {
    encode: (text: string) => number[];
    free?: () => void;
  } | null;
  private encoderInitPromise: Promise<void> | null = null;
  private ocrWorkerInitPromise: Promise<import("tesseract.js").Worker> | null =
    null;

  constructor() {
    // Initialize text splitter with optimal chunk size
    // Increased from 1000 to 2500 to reduce number of chunks for large files
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 2500,
      chunkOverlap: 250,
      separators: ["\n\n", "\n", ".", " ", ""],
    });

    // Don't initialize encoder here - do it lazily when needed
    this.encoder = null;
  }

  /**
   * Lazily initialize tiktoken encoder
   */
  private initializeEncoder(): Promise<void> {
    if (!this.encoderInitPromise) {
      this.encoderInitPromise = (async () => {
        try {
          const { getEncoding } = await import("js-tiktoken");
          this.encoder = getEncoding("o200k_base");
        } catch {
          logWarn(
            "Failed to initialize tiktoken, using fallback token counter",
          );
          this.encoder = null;
        }
      })();
    }
    return this.encoderInitPromise;
  }

  /**
   * Sanitize text to remove null bytes and control characters
   * PostgreSQL text fields cannot store null bytes (0x00)
   */
  private sanitizeText(text: string): string {
    return text
      .replace(/\0/g, "") // Remove null bytes
      .replace(/[\x01-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, " ") // Replace control characters with spaces (excluding null byte)
      .trim();
  }

  private withTimeout<T>(
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
   * Extract text content from various file types
   */
  async extractContent(
    buffer: Buffer,
    mimeType: string,
    onProgress?: ExtractionProgressCallback,
    signal?: AbortSignal,
  ): Promise<string> {
    const onAbort = () => this.cleanup();
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      if (signal?.aborted) throw signal.reason;

      switch (mimeType) {
        case "application/pdf":
          return await this.extractPDF(buffer, onProgress, signal);

        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        case "application/msword":
          return await this.extractWord(buffer);

        case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
          return await this.extractPowerPoint(buffer);

        case "image/jpeg":
        case "image/png":
        case "image/webp":
        case "image/tiff":
          return await this.extractTextFromImage(buffer, mimeType, signal);

        case "application/vnd.ms-powerpoint":
          throw new Error(
            "Legacy .ppt format is not supported. Please save your presentation as .pptx (PowerPoint 2007+) and upload again.",
          );

        case "text/plain":
        case "text/markdown":
        case "text/csv":
        case "application/json":
          // Sanitize text files as well
          return this.sanitizeText(buffer.toString("utf-8"));

        default:
          throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error: unknown) {
      logError(error, "Content extraction error");
      throw new Error(
        `Failed to extract content: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
  }

  /**
   * Extract text from PDF files
   */
  private async extractPDF(
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

    const { loadImage } = await import("@napi-rs/canvas");
    try {
      const img = await loadImage(buffer);
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

    const sanitizedText = await this.extractTextFromTrustedImage(
      buffer,
      signal,
    );

    if (!sanitizedText) {
      throw new Error("Image contains no readable text content");
    }

    return sanitizedText;
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

  private async getOCRWorker(): Promise<import("tesseract.js").Worker> {
    if (!this.ocrWorkerInitPromise) {
      this.ocrWorkerInitPromise = (async () => {
        const { createWorker } = await import("tesseract.js");
        const { tmpdir } = await import("node:os");
        const { join } = await import("node:path");

        return this.withTimeout(
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
    const result = await this.withTimeout(
      worker.recognize(buffer),
      OCR_CONFIG.RECOGNITION_TIMEOUT_MS,
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
   * Extract text from Word documents
   */
  private async extractWord(buffer: Buffer): Promise<string> {
    let sanitizedText: string;

    try {
      // Dynamic import to avoid build-time execution
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });

      // Sanitize the text to remove null bytes and other problematic characters
      sanitizedText = this.sanitizeText(result.value);
    } catch (error) {
      throw new Error(
        `Failed to extract Word document content: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!sanitizedText) {
      throw new Error("Word document contains no readable text content");
    }

    return sanitizedText;
  }

  /**
   * Recursively extract text from an officeparser AST node
   */
  private extractNodeText(node: OfficeparserNode): string {
    const parts: string[] = [];
    if (node.text) {
      parts.push(node.text);
    }
    if (node.children) {
      const childText = node.children
        .map((child) => this.extractNodeText(child))
        .filter(Boolean)
        .join("\n");
      if (childText) parts.push(childText);
    }
    return parts.join("\n");
  }

  /**
   * Extract text from PowerPoint presentations with slide boundaries and speaker notes
   */
  private async extractPowerPoint(buffer: Buffer): Promise<string> {
    let sanitizedText: string;

    try {
      // Dynamic import to avoid build-time execution
      // @ts-expect-error -- officeparser has no type declarations
      const { parseOffice } = (await import("officeparser")) as {
        parseOffice: (buffer: Buffer) => Promise<{
          content: Array<{
            type: string;
            children: OfficeparserNode[];
            metadata: Record<string, unknown>;
          }>;
          toText: () => string;
        }>;
      };
      const ast = await parseOffice(buffer);

      // Group content by slide number
      const slides = new Map<
        number,
        { slideText: string; notesText: string }
      >();

      for (const node of ast.content) {
        const slideNumber = (node.metadata as { slideNumber?: number })
          ?.slideNumber;
        if (slideNumber == null) continue;

        if (!slides.has(slideNumber)) {
          slides.set(slideNumber, { slideText: "", notesText: "" });
        }
        const entry = slides.get(slideNumber)!;

        const text = this.extractNodeText(node);
        if (!text) continue;

        if (node.type === "note") {
          entry.notesText = text;
        } else {
          entry.slideText = text;
        }
      }

      // Build output ordered by slide number
      const sortedSlides = [...slides.entries()].sort(([a], [b]) => a - b);
      const parts: string[] = [];

      for (const [slideNumber, { slideText, notesText }] of sortedSlides) {
        let section = `--- Slide ${slideNumber} ---\n${slideText}`;
        if (notesText) {
          section += `\n\n[Speaker Notes]\n${notesText}`;
        }
        parts.push(section);
      }

      const text = parts.join("\n\n");

      // Sanitize the text to remove null bytes and other problematic characters
      sanitizedText = this.sanitizeText(text);
    } catch (error) {
      throw new Error(
        `Failed to extract PowerPoint content: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!sanitizedText) {
      throw new Error(
        "PowerPoint presentation contains no readable text content",
      );
    }

    return sanitizedText;
  }

  /**
   * Process and chunk file content
   */
  async chunkText(content: string): Promise<string[]> {
    if (!content || content.trim().length === 0) {
      throw new Error("No content to process");
    }

    const chunks = await this.textSplitter.splitText(content);
    return chunks;
  }

  /**
   * Generate embeddings for chunks using OpenRouter client
   */
  async generateEmbeddingsForChunks(
    chunks: string[],
    openrouterClient: OpenRouterClient,
  ): Promise<number[][]> {
    return await openrouterClient.generateEmbeddings(chunks);
  }

  /**
   * Count tokens in text
   */
  async countTokens(text: string): Promise<number> {
    // Initialize encoder if not already done
    await this.initializeEncoder();

    if (this.encoder) {
      try {
        const tokens = this.encoder.encode(text);
        return tokens.length;
      } catch (error) {
        // Fallback to approximate count
        return Math.ceil(text.length / CHARS_PER_TOKEN);
      }
    }
    // Fallback: approximate 1 token per 4 characters
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  /**
   * Build context from relevant chunks for the AI
   */
  buildContext(
    chunks: Array<{
      content: string;
      fileName: string;
      chunkIndex: number;
      similarity?: number;
    }>,
  ): string {
    if (chunks.length === 0) {
      return "";
    }

    const context = chunks
      .map((chunk) => {
        return `[Source: ${chunk.fileName} - Part ${chunk.chunkIndex + 1}]\n${chunk.content}`;
      })
      .join("\n\n---\n\n");

    return `Based on the following context from uploaded documents:\n\n${context}\n\n`;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have the same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += (a[i] ?? 0) * (b[i] ?? 0);
      normA += (a[i] ?? 0) * (a[i] ?? 0);
      normB += (b[i] ?? 0) * (b[i] ?? 0);
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
      return 0;
    }
    return dotProduct / denominator;
  }

  /**
   * Simple keyword matching as fallback
   */
  keywordMatch(query: string, text: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const textLower = text.toLowerCase();
    let matches = 0;

    for (const word of queryWords) {
      if (word.length > 3 && textLower.includes(word)) {
        matches++;
      }
    }

    return matches / queryWords.length;
  }

  /**
   * Re-rank chunks by similarity score
   */
  rerank<T extends { content: string; similarity: number }>(
    chunks: T[],
    topK: number = 5,
  ): T[] {
    return chunks.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  /**
   * Free up resources
   */
  cleanup() {
    if (this.encoder && typeof this.encoder.free === "function") {
      this.encoder.free();
    }
    this.encoder = null;
    this.encoderInitPromise = null;

    const workerPromise = this.ocrWorkerInitPromise;
    this.ocrWorkerInitPromise = null;
    if (workerPromise) {
      void workerPromise.then((w) => w.terminate()).catch(() => {});
    }
  }
}

/**
 * Create RAG service instance
 */
export function createRAGService(): RAGService {
  return new RAGService();
}
