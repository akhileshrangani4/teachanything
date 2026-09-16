import { jest, describe, it, expect, beforeEach } from "@jest/globals";

/**
 * A malformed retrieval call must not end the student's turn.
 *
 * `experimental_repairToolCall` only covers `showQuiz`, so anything the AI SDK
 * refuses on a retrieval tool becomes `AI_InvalidToolInputError`, which
 * `onStreamError` renders as "Failed to generate a response. Please try
 * again." The student loses their question over the model quoting a number or
 * naming a file.
 *
 * The fix is to let the calls a model plausibly makes reach `execute`, and
 * answer them there with something the model can act on. These pin that
 * behavior: a document named rather than identified, a count above the cap, a
 * page that cannot exist, and a reference to nothing at all.
 */

const hybridSearch =
  jest.fn<
    (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>
  >();

jest.unstable_mockModule("@/server/hybrid-search", () => ({
  hybridSearch,
}));

const { createRetrievalTools } = await import("@/server/retrieval-tools");

const SYLLABUS_ID = "550e8400-e29b-41d4-a716-446655440000";
const NOTES_ID = "6f0a5c2e-7b7b-4c5a-9b4a-2f1d3e4c5a6b";

const DOCUMENTS = [
  { fileId: SYLLABUS_ID, fileName: "Syllabus.pdf" },
  { fileId: NOTES_ID, fileName: "Week 3 Notes.docx" },
];

/**
 * Drizzle's builder is chainable and thenable, so one proxy that returns
 * itself for every call and resolves to `rows` covers both the document lookup
 * and the page query without modelling the query builder.
 */
function mockDb(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  const chain = new Proxy(builder, {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (value: unknown) => void) => resolve(rows);
      }
      return () => chain;
    },
  });
  return chain;
}

const makeTools = (rows: unknown[] = DOCUMENTS) =>
  createRetrievalTools({
    db: mockDb(rows) as never,
    fileIds: [SYLLABUS_ID, NOTES_ID],
    aiClient: {
      generateEmbedding: async () => [0.1, 0.2, 0.3],
    } as never,
  });

/**
 * Call a tool the way the AI SDK does: validate the raw input against the
 * tool's own `inputSchema` first, then execute. Calling `execute` directly
 * would skip the schema and test a pipeline that does not exist.
 *
 * A rejected input is the failure under test. That is what raises
 * `AI_InvalidToolInputError` in production and ends the student's turn, so it
 * is returned rather than thrown and asserted on explicitly.
 */
const run = async (
  tool: {
    inputSchema: {
      safeParse: (input: unknown) => { success: boolean; data?: unknown };
    };
    execute?: (input: never, options: never) => unknown;
  },
  input: unknown,
) => {
  const parsed = tool.inputSchema.safeParse(input);
  if (!parsed.success) return { TURN_WOULD_DIE: true } as const;
  return await tool.execute?.(parsed.data as never, {} as never);
};

describe("retrieval tools recovering from a model's mistakes", () => {
  beforeEach(() => {
    hybridSearch.mockReset();
    hybridSearch.mockResolvedValue([]);
  });

  it("accepts a document named the way the file manifest names it", async () => {
    // The system prompt lists names, never ids, so this is the reference a
    // model has actually been given.
    const { tools } = makeTools();

    await run(tools.search_documents, {
      query: "grading policy",
      fileId: "Syllabus.pdf",
    });

    expect(hybridSearch).toHaveBeenCalledTimes(1);
    expect(hybridSearch.mock.calls[0]![0]).toMatchObject({
      fileId: SYLLABUS_ID,
    });
  });

  it("matches a name regardless of case", async () => {
    const { tools } = makeTools();

    await run(tools.search_documents, {
      query: "readings",
      fileId: "week 3 notes.docx",
    });

    expect(hybridSearch.mock.calls[0]![0]).toMatchObject({ fileId: NOTES_ID });
  });

  it("answers an unknown document with the ones that exist", async () => {
    const { tools } = makeTools();

    const result = (await run(tools.search_documents, {
      query: "midterm",
      fileId: "lecture-notes-final-v2.pdf",
    })) as { error: string; availableDocuments: string[] };

    // A tool result, not a thrown error: the model reads this and can retry
    // on the next step.
    expect(result.error).toContain("lecture-notes-final-v2.pdf");
    expect(result.availableDocuments).toEqual([
      "Syllabus.pdf",
      "Week 3 Notes.docx",
    ]);
    expect(hybridSearch).not.toHaveBeenCalled();
  });

  it("never resolves a document outside this chatbot", async () => {
    // Authorization: the lookup only ever runs over ctx.fileIds, so an id from
    // another chatbot resolves to nothing rather than being trusted.
    const { tools } = makeTools();

    const result = (await run(tools.search_documents, {
      query: "anything",
      fileId: "11111111-2222-3333-4444-555555555555",
    })) as { error: string };

    expect(result.error).toContain("No document matches");
    expect(hybridSearch).not.toHaveBeenCalled();
  });

  it("searches anyway when the model over-reaches on the count", async () => {
    // Losing the student's question over "50 results please" would be an
    // absurd trade, so the count falls back to the default and the search
    // still runs.
    const { tools } = makeTools();

    const result = await run(tools.search_documents, {
      query: "q",
      limit: 50,
    });

    expect(result).not.toMatchObject({ TURN_WOULD_DIE: true });
    expect(hybridSearch.mock.calls[0]![0]).toMatchObject({ limit: 6 });

    await run(tools.search_documents, { query: "q", limit: "five" });
    expect(hybridSearch.mock.calls[1]![0]).toMatchObject({ limit: 6 });
  });

  it("still ends the turn on a search with no query, as it should", async () => {
    // The recovery is deliberately not blanket. A search with no query has
    // nothing to recover to, and inventing one would answer a question the
    // student never asked.
    const { tools } = makeTools();

    expect(
      await run(tools.search_documents, { fileId: "Syllabus.pdf" }),
    ).toMatchObject({
      TURN_WOULD_DIE: true,
    });
    expect(hybridSearch).not.toHaveBeenCalled();
  });

  it("keeps the default when no count is given", async () => {
    const { tools } = makeTools();

    await run(tools.search_documents, { query: "q" });

    expect(hybridSearch.mock.calls[0]![0]).toMatchObject({ limit: 6 });
  });

  it("explains a page that cannot exist instead of failing the turn", async () => {
    const { tools } = makeTools();

    const result = (await run(tools.get_page, {
      fileId: "Syllabus.pdf",
      pageNumber: 0,
    })) as { error: string };

    expect(result.error).toContain("numbered from 1");
  });

  it("looks the document list up once across several calls", async () => {
    // The lookup is a database round trip on a path the model can hit
    // repeatedly within one turn.
    const selectSpy = jest.fn(() => mockDb(DOCUMENTS));
    const db = { select: selectSpy } as never;

    const { tools } = createRetrievalTools({
      db,
      fileIds: [SYLLABUS_ID, NOTES_ID],
      aiClient: { generateEmbedding: async () => [0.1] } as never,
    });

    await run(tools.search_documents, { query: "a", fileId: "Syllabus.pdf" });
    await run(tools.search_documents, { query: "b", fileId: "Syllabus.pdf" });
    await run(tools.search_documents, { query: "c", fileId: "unknown.pdf" });

    expect(selectSpy).toHaveBeenCalledTimes(1);
  });

  it("skips the lookup entirely when the model sends a real id", async () => {
    const selectSpy = jest.fn(() => mockDb(DOCUMENTS));

    const { tools } = createRetrievalTools({
      db: { select: selectSpy } as never,
      fileIds: [SYLLABUS_ID],
      aiClient: { generateEmbedding: async () => [0.1] } as never,
    });

    await run(tools.search_documents, { query: "q", fileId: SYLLABUS_ID });

    expect(selectSpy).not.toHaveBeenCalled();
    expect(hybridSearch.mock.calls[0]![0]).toMatchObject({
      fileId: SYLLABUS_ID,
    });
  });
});
