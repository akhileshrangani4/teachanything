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
import { RAGService, createRAGService } from "../rag-service";

// Suppress expected console.error from error-path tests
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe("RAGService", () => {
  let service: RAGService;

  beforeEach(() => {
    service = new RAGService();
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
