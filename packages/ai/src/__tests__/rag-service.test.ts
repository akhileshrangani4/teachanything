import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "@jest/globals";
import type { RAGService as RAGServiceInstance } from "../rag-service";

const loadImageMock = jest.fn(() =>
  Promise.resolve({ width: 100, height: 100 }),
);
const pdfParseMock = jest.fn(() =>
  Promise.resolve({ text: "mocked pdf text", numpages: 1 }),
);

jest.unstable_mockModule("tesseract.js", () => ({
  createWorker: jest.fn(() =>
    Promise.resolve({
      recognize: jest.fn(() =>
        Promise.resolve({ data: { text: "mocked ocr text" } }),
      ),
      terminate: jest.fn(() => Promise.resolve(undefined)),
    }),
  ),
}));

jest.unstable_mockModule("pdf-parse", () => ({
  default: pdfParseMock,
}));

jest.unstable_mockModule("@napi-rs/canvas", () => ({
  loadImage: loadImageMock,
  createCanvas: jest.fn().mockReturnValue({
    getContext: jest.fn(),
    toBuffer: jest.fn().mockReturnValue(Buffer.from("mock image png")),
  }),
  DOMMatrix: class {},
  ImageData: class {},
  Path2D: class {},
}));

const getDocumentMock = jest.fn(() => ({
  promise: Promise.resolve({
    numPages: 1,
    getPage: jest.fn(() =>
      Promise.resolve({
        getTextContent: jest.fn(() =>
          Promise.resolve({ items: [{ str: "mocked pdf text" }] }),
        ),
        getViewport: jest.fn(() => ({ width: 100, height: 100 })),
        render: jest.fn(() => ({ promise: Promise.resolve() })),
        cleanup: jest.fn(),
      }),
    ),
    destroy: jest.fn(() => Promise.resolve(undefined)),
  }),
}));

jest.unstable_mockModule("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: getDocumentMock,
}));

const { RAGService, createRAGService } = await import("../rag-service");

function makePngHeader(width: number, height: number): Buffer {
  // 8-byte signature, IHDR length (0x0000000D), "IHDR", width@16, height@20.
  const buf = Buffer.alloc(28);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(0x0000000d, 8); // IHDR chunk length
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

// Suppress expected console.error from error-path tests
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe("RAGService", () => {
  let service: RAGServiceInstance;

  beforeEach(() => {
    service = new RAGService();
    loadImageMock.mockResolvedValue({ width: 100, height: 100 });
    pdfParseMock.mockResolvedValue({ text: "mocked pdf text", numpages: 1 });
  });

  afterEach(() => {
    service.cleanup();
  });

  describe("createRAGService", () => {
    it("returns a RAGService instance", () => {
      const instance = createRAGService();
      expect(instance).toBeInstanceOf(RAGService);
      instance.cleanup();
    });
  });

  describe("cosineSimilarity", () => {
    it("returns 1 for identical vectors", () => {
      const vector = [1, 0, 0];
      expect(service.cosineSimilarity(vector, vector)).toBeCloseTo(1);
    });

    it("returns 0 for orthogonal vectors", () => {
      const a = [1, 0];
      const b = [0, 1];
      expect(service.cosineSimilarity(a, b)).toBeCloseTo(0);
    });

    it("returns -1 for opposite vectors", () => {
      const a = [1, 0];
      const b = [-1, 0];
      expect(service.cosineSimilarity(a, b)).toBeCloseTo(-1);
    });

    it("throws for vectors of different lengths", () => {
      expect(() => service.cosineSimilarity([1, 2], [1, 2, 3])).toThrow(
        "Vectors must have the same length",
      );
    });
  });

  describe("keywordMatch", () => {
    it("returns match score for overlapping keywords", () => {
      const score = service.keywordMatch(
        "machine learning algorithms",
        "This document covers machine learning and deep learning algorithms",
      );
      expect(score).toBeGreaterThan(0);
    });

    it("returns 0 when no keywords match", () => {
      const score = service.keywordMatch(
        "quantum physics",
        "This is about cooking recipes",
      );
      expect(score).toBe(0);
    });

    it("ignores words with 3 or fewer characters", () => {
      const score = service.keywordMatch("the a is", "the a is in document");
      expect(score).toBe(0);
    });
  });

  describe("buildContext", () => {
    it("returns empty string for no chunks", () => {
      expect(service.buildContext([])).toBe("");
    });

    it("builds formatted context from chunks", () => {
      const chunks = [
        { content: "Hello world", fileName: "test.txt", chunkIndex: 0 },
        { content: "Goodbye world", fileName: "test.txt", chunkIndex: 1 },
      ];
      const context = service.buildContext(chunks);
      expect(context).toContain("[Source: test.txt - Part 1]");
      expect(context).toContain("[Source: test.txt - Part 2]");
      expect(context).toContain("Hello world");
      expect(context).toContain("Goodbye world");
    });
  });

  describe("rerank", () => {
    it("returns top K chunks sorted by similarity", () => {
      const chunks = [
        { content: "a", similarity: 0.5 },
        { content: "b", similarity: 0.9 },
        { content: "c", similarity: 0.7 },
        { content: "d", similarity: 0.3 },
      ];
      const result = service.rerank(chunks, 2);
      expect(result).toHaveLength(2);
      expect(result[0]!.content).toBe("b");
      expect(result[1]!.content).toBe("c");
    });

    it("defaults to top 5", () => {
      const chunks = Array.from({ length: 10 }, (_, i) => ({
        content: `chunk-${i}`,
        similarity: i / 10,
      }));
      const result = service.rerank(chunks);
      expect(result).toHaveLength(5);
    });
  });

  describe("chunkText", () => {
    it("splits text into chunks", async () => {
      const longText = "This is a test sentence. ".repeat(200);
      const chunks = await service.chunkText(longText);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0]).toBeTruthy();
    });

    it("throws for empty content", async () => {
      await expect(service.chunkText("")).rejects.toThrow(
        "No content to process",
      );
    });

    it("throws for whitespace-only content", async () => {
      await expect(service.chunkText("   ")).rejects.toThrow(
        "No content to process",
      );
    });
  });

  describe("extractContent", () => {
    it("extracts text from plain text buffer", async () => {
      const buffer = Buffer.from("Hello, world!");
      const result = await service.extractContent(buffer, "text/plain");
      expect(result).toBe("Hello, world!");
    });

    it("extracts text from JSON buffer", async () => {
      const json = JSON.stringify({ key: "value" });
      const buffer = Buffer.from(json);
      const result = await service.extractContent(buffer, "application/json");
      expect(result).toBe(json);
    });

    it("sanitizes null bytes from text content", async () => {
      const buffer = Buffer.from("Hello\0World");
      const result = await service.extractContent(buffer, "text/plain");
      expect(result).toBe("HelloWorld");
    });

    it("throws for unsupported file types", async () => {
      const buffer = Buffer.from("data");
      await expect(
        service.extractContent(buffer, "application/zip"),
      ).rejects.toThrow("Unsupported file type");
    });

    it("extracts text from image buffer via OCR mock", async () => {
      const buffer = makePngHeader(10, 10);
      loadImageMock.mockResolvedValue({ width: 10, height: 10 });
      const result = await service.extractContent(buffer, "image/png");
      expect(result).toBe("mocked ocr text");
    });

    it("extracts text from PDF buffer", async () => {
      const buffer = Buffer.from("%PDF-1.4 mock data");
      const result = await service.extractContent(buffer, "application/pdf");
      expect(result).toBe("mocked pdf text");
    });

    it("respects abort signals during extraction", async () => {
      const controller = new AbortController();
      controller.abort(new Error("Timeout Testing Abort"));
      const buffer = Buffer.from("%PDF-1.4 mock data");

      await expect(
        service.extractContent(
          buffer,
          "application/pdf",
          undefined,
          controller.signal,
        ),
      ).rejects.toThrow("Timeout Testing Abort");
    });

    it("aborts mid-loop during multi-page PDF OCR fallback and destroys the document", async () => {
      const controller = new AbortController();
      const destroyMock = jest.fn(() => Promise.resolve(undefined));

      // A page whose text is above the per-page OCR threshold, so the loop
      // takes the plain-text branch and the per-page abort check runs.
      const makePage = () => ({
        getTextContent: jest.fn(() =>
          Promise.resolve({ items: [{ str: "this page has plenty of text" }] }),
        ),
        getViewport: jest.fn(() => ({ width: 100, height: 100 })),
        render: jest.fn(() => ({ promise: Promise.resolve() })),
        cleanup: jest.fn(),
      });

      const getPageMock = jest.fn((pageNumber?: number) => {
        // Trigger abort when page 2 is requested so the per-page
        // `if (signal?.aborted) throw signal.reason` check fires after page 1.
        if (pageNumber === 2) {
          controller.abort(new Error("aborted mid-loop"));
        }
        return Promise.resolve(makePage());
      });

      getDocumentMock.mockReturnValueOnce({
        promise: Promise.resolve({
          numPages: 5,
          getPage: getPageMock,
          destroy: destroyMock,
        }),
      });

      // Force the OCR fallback path: empty parsed text => shouldUsePDFOCRFallback.
      pdfParseMock.mockResolvedValueOnce({ text: "", numpages: 5 });

      const buffer = Buffer.from("%PDF-1.4 mock data");

      await expect(
        service.extractContent(
          buffer,
          "application/pdf",
          undefined,
          controller.signal,
        ),
      ).rejects.toThrow(/aborted mid-loop/);

      expect(destroyMock).toHaveBeenCalledTimes(1);
    });

    it("rejects oversized images during validation", async () => {
      // >25MB buffer with a valid PNG signature; rejected at the byte-size
      // check in validateImageBuffer before the dimension probe runs.
      const buffer = Buffer.alloc(26 * 1024 * 1024);
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(
        buffer,
        0,
      );

      await expect(service.extractContent(buffer, "image/png")).rejects.toThrow(
        "Image exceeds OCR size limit",
      );
    });
  });

  describe("countTokens", () => {
    it("returns a positive count for non-empty text", async () => {
      const count = await service.countTokens("Hello world, this is a test.");
      expect(count).toBeGreaterThan(0);
    });

    it("returns 0 for empty text", async () => {
      const count = await service.countTokens("");
      expect(count).toBe(0);
    });
  });
});
