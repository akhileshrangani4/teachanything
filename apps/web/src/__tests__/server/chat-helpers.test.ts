import { describe, it, expect } from "@jest/globals";
import { clampMaxTokens, describeToolActivity } from "@/server/chat-helpers";

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
