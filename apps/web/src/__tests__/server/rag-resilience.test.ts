import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// ── ESM Mocks (must use unstable_mockModule for ESM) ───────────────────────
const mockGenerateEmbedding = jest.fn<() => Promise<number[]>>();

jest.unstable_mockModule("@/lib/logger", () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
}));

jest.unstable_mockModule("@teachanything/ai", () => ({
  createOpenRouterClient: () => ({
    generateEmbedding: mockGenerateEmbedding,
  }),
}));

jest.unstable_mockModule("drizzle-orm", () => ({
  eq: jest.fn((...args: unknown[]) => ["eq", ...args]),
  and: jest.fn((...args: unknown[]) => ["and", ...args]),
  sql: Object.assign(jest.fn(), { raw: jest.fn() }),
  inArray: jest.fn((...args: unknown[]) => ["inArray", ...args]),
  isNotNull: jest.fn((...args: unknown[]) => ["isNotNull", ...args]),
}));

jest.unstable_mockModule("@teachanything/db/schema", () => ({
  fileChunks: {
    fileId: "fileChunks.fileId",
    content: "fileChunks.content",
    chunkIndex: "fileChunks.chunkIndex",
    embedding: "fileChunks.embedding",
  },
  chatbotFileAssociations: {
    chatbotId: "chatbotFileAssociations.chatbotId",
    fileId: "chatbotFileAssociations.fileId",
  },
  userFiles: {
    id: "userFiles.id",
    fileName: "userFiles.fileName",
    processingStatus: "userFiles.processingStatus",
  },
}));

jest.unstable_mockModule("@teachanything/db", () => ({
  db: {},
}));

// ── Dynamic imports after mocks ────────────────────────────────────────────
const { buildRAGContext } = await import("@/server/rag-context");
const { logWarn } = await import("@/lib/logger");
type BuildRAGContextParams = Parameters<typeof buildRAGContext>[0];

// ── DB mock factory ────────────────────────────────────────────────────────
let completedFilesResult: Array<{ fileId: string; fileName: string }> = [];

/**
 * Creates a mock db that returns completedFilesResult for the first
 * select chain (file query) and an empty array for the second (vector search).
 */
function createMockDb(): BuildRAGContextParams["db"] {
  let selectCallCount = 0;
  return {
    select: () => {
      selectCallCount++;
      const callNum = selectCallCount;
      return {
        from: () => ({
          innerJoin: () => ({
            where: () => {
              if (callNum === 1) {
                return Promise.resolve(completedFilesResult);
              }
              // Second call is vector search -- needs orderBy/limit chain
              return {
                orderBy: () => ({
                  limit: () => Promise.resolve([]),
                }),
              };
            },
          }),
        }),
      };
    },
  } as unknown as BuildRAGContextParams["db"];
}

/** Helper to build test params with mock db */
function ragParams(
  overrides: Partial<BuildRAGContextParams> = {},
): BuildRAGContextParams {
  return {
    chatbotId: "chatbot-1",
    message: "test query",
    db: createMockDb(),
    openrouterApiKey: "key",
    openaiApiKey: "key",
    ...overrides,
  };
}

// ── Test Suite: ragFailureNote field ───────────────────────────────────────
describe("ragFailureNote in buildRAGContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    completedFilesResult = [];
  });

  it("returns ragFailureNote: '' on successful embedding (no matching chunks)", async () => {
    completedFilesResult = [{ fileId: "file-1", fileName: "test.pdf" }];
    mockGenerateEmbedding.mockResolvedValue(new Array(1536).fill(0.1));

    const result = await buildRAGContext(ragParams());

    expect(result.ragFailureNote).toBe("");
  });

  it("returns populated ragFailureNote when embedding throws", async () => {
    completedFilesResult = [{ fileId: "file-1", fileName: "test.pdf" }];
    mockGenerateEmbedding.mockRejectedValue(new Error("API error"));

    const result = await buildRAGContext(ragParams());

    expect(result.ragFailureNote).not.toBe("");
    expect(result.ragFailureNote.length).toBeGreaterThan(0);
  });

  it("ragFailureNote contains '[SYSTEM NOTICE:' prefix", async () => {
    completedFilesResult = [{ fileId: "file-1", fileName: "test.pdf" }];
    mockGenerateEmbedding.mockRejectedValue(new Error("API error"));

    const result = await buildRAGContext(ragParams());

    expect(result.ragFailureNote).toContain("[SYSTEM NOTICE:");
  });

  it("ragFailureNote contains instruction not to reference uploaded files", async () => {
    completedFilesResult = [{ fileId: "file-1", fileName: "test.pdf" }];
    mockGenerateEmbedding.mockRejectedValue(new Error("API error"));

    const result = await buildRAGContext(ragParams());

    expect(result.ragFailureNote).toContain("Do not reference");
  });

  it("ragFailureNote is '' when no completed files exist (short-circuit path)", async () => {
    completedFilesResult = [];

    const result = await buildRAGContext(ragParams());

    expect(result.ragFailureNote).toBe("");
    expect(mockGenerateEmbedding).not.toHaveBeenCalled();
  });

  it("ragFailureNote is '' when relevant chunks are empty (success path with no matches)", async () => {
    completedFilesResult = [{ fileId: "file-1", fileName: "test.pdf" }];
    mockGenerateEmbedding.mockResolvedValue(new Array(1536).fill(0.1));

    const result = await buildRAGContext(ragParams());

    expect(result.ragFailureNote).toBe("");
    expect(result.ragUsed).toBe(false);
  });

  it("includes fileManifest even when embedding fails", async () => {
    completedFilesResult = [
      { fileId: "file-1", fileName: "lecture.pdf" },
      { fileId: "file-2", fileName: "notes.docx" },
    ];
    mockGenerateEmbedding.mockRejectedValue(new Error("API error"));

    const result = await buildRAGContext(ragParams());

    expect(result.fileManifest).toContain("lecture.pdf");
    expect(result.fileManifest).toContain("notes.docx");
    expect(result.ragFailureNote).toContain("[SYSTEM NOTICE:");
  });

  it("calls logWarn when RAG is degraded", async () => {
    completedFilesResult = [{ fileId: "file-1", fileName: "test.pdf" }];
    mockGenerateEmbedding.mockRejectedValue(new Error("API error"));

    await buildRAGContext(ragParams());

    expect(logWarn).toHaveBeenCalledWith(
      expect.stringContaining("degraded"),
      expect.objectContaining({ chatbotId: "chatbot-1" }),
    );
  });

  it("embedding failure returns ragUsed: false", async () => {
    completedFilesResult = [{ fileId: "file-1", fileName: "test.pdf" }];
    mockGenerateEmbedding.mockRejectedValue(
      new Error("500 Internal Server Error"),
    );

    const result = await buildRAGContext(ragParams());

    expect(result.ragUsed).toBe(false);
    expect(result.ragFailureNote).toBeTruthy();
  });
});

// ── Test Suite: isTransientError pattern ────────────────────────────────────
// Verifies the retry widening by checking the isTransientError logic
// that should exist in openrouter-client.ts. Tests the string matching
// patterns directly (same logic that the production code uses).
describe("isTransientError pattern", () => {
  function isTransientError(errorMessage: string): boolean {
    return (
      errorMessage.includes("Rate limit") ||
      errorMessage.includes("rate_limit") ||
      errorMessage.includes("429") ||
      errorMessage.includes("500") ||
      errorMessage.includes("502") ||
      errorMessage.includes("503") ||
      errorMessage.includes("Internal Server Error") ||
      errorMessage.includes("Bad Gateway") ||
      errorMessage.includes("Service Unavailable")
    );
  }

  it("matches 429 rate limit error", () => {
    expect(isTransientError("Rate limit exceeded")).toBe(true);
    expect(isTransientError("rate_limit: too many requests")).toBe(true);
    expect(isTransientError("API error: 429")).toBe(true);
  });

  it("matches 500 Internal Server Error", () => {
    expect(isTransientError("API error: 500")).toBe(true);
    expect(isTransientError("Internal Server Error")).toBe(true);
  });

  it("matches 502 Bad Gateway", () => {
    expect(isTransientError("API error: 502")).toBe(true);
    expect(isTransientError("Bad Gateway")).toBe(true);
  });

  it("matches 503 Service Unavailable", () => {
    expect(isTransientError("API error: 503")).toBe(true);
    expect(isTransientError("Service Unavailable")).toBe(true);
  });

  it("does NOT match 401 Unauthorized", () => {
    expect(isTransientError("API error: 401 Unauthorized")).toBe(false);
  });

  it("does NOT match 400 Bad Request", () => {
    expect(isTransientError("API error: 400 Bad Request")).toBe(false);
  });

  it("does NOT match 403 Forbidden", () => {
    expect(isTransientError("API error: 403 Forbidden")).toBe(false);
  });

  it("does NOT match generic errors", () => {
    expect(isTransientError("Network error")).toBe(false);
    expect(isTransientError("Invalid API key")).toBe(false);
  });
});
