import { describe, it, expect } from "@jest/globals";
import {
  clampMaxTokens,
  describeToolActivity,
  deriveStatusLine,
  mergeSources,
} from "@/server/chat-helpers";
import type { StudyUIMessage } from "@/server/chat/study-tools";

// Minimal fixtures: deriveStatusLine only reads `role` and the last part's
// `type`/`input`, so we cast small literals rather than build full UIMessages.
const assistantWith = (part: unknown): StudyUIMessage =>
  ({ id: "m", role: "assistant", parts: [part] }) as unknown as StudyUIMessage;

describe("clampMaxTokens", () => {
  it("returns the default for null/undefined/NaN", () => {
    expect(clampMaxTokens(null)).toBe(2000);
    expect(clampMaxTokens(undefined)).toBe(2000);
    expect(clampMaxTokens(NaN)).toBe(2000);
  });
  it("clamps below the minimum up to 100", () => {
    expect(clampMaxTokens(0)).toBe(100);
    expect(clampMaxTokens(50)).toBe(100);
  });
  it("clamps above the maximum down to 4000", () => {
    expect(clampMaxTokens(10000)).toBe(4000);
  });
  it("passes through values in range", () => {
    expect(clampMaxTokens(1500)).toBe(1500);
  });
});

describe("describeToolActivity", () => {
  it("includes the user query for search_documents", () => {
    expect(describeToolActivity("search_documents", { query: "Berlin" })).toBe(
      "Searching documents for “Berlin”",
    );
  });
  it("truncates an over-long search query with an ellipsis", () => {
    const label = describeToolActivity("search_documents", {
      query: "a".repeat(200),
    });
    expect(label.startsWith("Searching documents for “aaaa")).toBe(true);
    expect(label.endsWith("…”")).toBe(true);
    // Fixed prose + quotes, plus 48 query chars and the one ellipsis char.
    expect(label.length).toBe("Searching documents for “”".length + 48 + 1);
  });
  it("truncates on a code-point boundary so it never splits an emoji", () => {
    // 47 ASCII + 3 emoji = 50 code points; the 48-char cut lands right after the
    // first emoji, which must stay whole (a naive UTF-16 slice would halve it).
    const query = "a".repeat(47) + "😀😀😀";
    expect(describeToolActivity("search_documents", { query })).toBe(
      `Searching documents for “${"a".repeat(47)}😀…”`,
    );
  });
  it("falls back to a generic search label when query is missing/empty", () => {
    expect(describeToolActivity("search_documents", {})).toBe(
      "Searching documents…",
    );
    expect(describeToolActivity("search_documents", { query: "" })).toBe(
      "Searching documents…",
    );
  });
  it("labels page and neighbor lookups", () => {
    expect(describeToolActivity("get_page", { pageNumber: 14 })).toBe(
      "Reading page 14…",
    );
    // Partial input (still streaming): pageNumber may not have arrived yet.
    expect(describeToolActivity("get_page", {})).toBe("Reading a page…");
    expect(describeToolActivity("get_context_around", {})).toBe(
      "Reading surrounding context…",
    );
    expect(describeToolActivity("list_documents", {})).toBe(
      "Looking through your documents…",
    );
  });
  it("never throws on missing input and uses a generic fallback", () => {
    expect(describeToolActivity("done", undefined)).toBe("Working…");
    expect(describeToolActivity("unknown_tool", null)).toBe("Working…");
  });
});

describe("deriveStatusLine", () => {
  it("shows retrieval while the request is pre-stream (submitted)", () => {
    expect(deriveStatusLine(undefined, "submitted")).toBe("Searching sources…");
  });
  it("falls back to a generic label once the stream ends", () => {
    expect(deriveStatusLine(undefined, "ready")).toBe("Thinking…");
    expect(deriveStatusLine(undefined, "error")).toBe("Thinking…");
  });
  it("names the active retrieval tool while streaming", () => {
    const msg = assistantWith({
      type: "tool-search_documents",
      input: { query: "Berlin" },
    });
    expect(deriveStatusLine(msg, "streaming")).toBe(
      "Searching documents for “Berlin”",
    );
  });
  it("shows generation while streaming with no active tool", () => {
    expect(
      deriveStatusLine(assistantWith({ type: "text", text: "" }), "streaming"),
    ).toBe("Generating answer…");
    // The transient window before the assistant message lands.
    expect(deriveStatusLine(undefined, "streaming")).toBe("Generating answer…");
  });
});

describe("mergeSources", () => {
  const rag = (fileName: string, chunkIndex: number, similarity = 0.8) => ({
    fileName,
    chunkIndex,
    similarity,
  });
  const tool = (
    fileName: string,
    chunkIndex: number,
    similarity: number | null = 0.5,
    pageNumber: number | null = null,
  ) => ({ fileName, chunkIndex, similarity, pageNumber });

  it("returns rag sources unchanged when no tool sources exist", () => {
    const sources = [rag("a.pdf", 0), rag("b.pdf", 3)];
    expect(mergeSources(sources, [])).toEqual(sources);
  });

  it("appends tool-discovered chunks after the injected sources", () => {
    const merged = mergeSources([rag("a.pdf", 0)], [tool("b.pdf", 2, 0.6, 4)]);
    expect(merged).toEqual([
      rag("a.pdf", 0),
      { fileName: "b.pdf", chunkIndex: 2, similarity: 0.6, pageNumber: 4 },
    ]);
  });

  it("dedupes by file + chunk, keeping the injected source", () => {
    const merged = mergeSources(
      [rag("a.pdf", 0, 0.9)],
      [tool("a.pdf", 0, 0.4), tool("a.pdf", 1)],
    );
    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual(rag("a.pdf", 0, 0.9));
    expect(merged[1]?.chunkIndex).toBe(1);
  });

  it("dedupes repeated tool sources (same chunk hit by multiple searches)", () => {
    const merged = mergeSources([], [tool("a.pdf", 5), tool("a.pdf", 5)]);
    expect(merged).toHaveLength(1);
  });

  it("coerces null tool similarity to 0", () => {
    const merged = mergeSources([], [tool("a.pdf", 1, null)]);
    expect(merged[0]?.similarity).toBe(0);
  });

  it("does not conflate same chunk index across different files", () => {
    const merged = mergeSources([rag("a.pdf", 1)], [tool("b.pdf", 1)]);
    expect(merged).toHaveLength(2);
  });
});
