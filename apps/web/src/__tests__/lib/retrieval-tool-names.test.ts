import { describe, it, expect } from "@jest/globals";
import {
  RETRIEVAL_TOOL_NAMES,
  RETRIEVAL_PART_TYPES,
  isRetrievalToolName,
  isRetrievalToolPart,
} from "@/lib/retrieval-tool-names";

describe("retrieval tool name constants", () => {
  it("covers the five retrieval/loop tools", () => {
    expect([...RETRIEVAL_TOOL_NAMES].sort()).toEqual(
      [
        "done",
        "get_context_around",
        "get_page",
        "list_documents",
        "search_documents",
      ].sort(),
    );
  });

  it("keeps the client part-type set in sync with the bare names", () => {
    // Guards the drift the two-list duplication used to allow: the client
    // status-line set must be exactly the `tool-`-prefixed server names.
    expect([...RETRIEVAL_PART_TYPES].sort()).toEqual(
      RETRIEVAL_TOOL_NAMES.map((n) => `tool-${n}`).sort(),
    );
  });
});

describe("isRetrievalToolName", () => {
  it("matches retrieval tools and rejects study tools", () => {
    expect(isRetrievalToolName("search_documents")).toBe(true);
    expect(isRetrievalToolName("done")).toBe(true);
    expect(isRetrievalToolName("showQuiz")).toBe(false);
    expect(isRetrievalToolName("")).toBe(false);
  });
});

describe("isRetrievalToolPart", () => {
  it("drops retrieval tool parts and keeps study/text parts", () => {
    expect(isRetrievalToolPart("tool-search_documents")).toBe(true);
    expect(isRetrievalToolPart("tool-done")).toBe(true);
    expect(isRetrievalToolPart("tool-showQuiz")).toBe(false);
    expect(isRetrievalToolPart("text")).toBe(false);
    expect(isRetrievalToolPart("reasoning")).toBe(false);
  });
});
