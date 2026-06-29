import { describe, it, expect } from "@jest/globals";
import { hasQuotedPhrase } from "@/server/hybrid-search";

describe("hasQuotedPhrase", () => {
  it("detects a quoted phrase (triggers FTS boost)", () => {
    expect(hasQuotedPhrase('did it mention "the Berlin airlift"?')).toBe(true);
  });
  it("is false for unquoted queries", () => {
    expect(hasQuotedPhrase("does it mention the berlin airlift")).toBe(false);
  });
  it("ignores empty quotes", () => {
    expect(hasQuotedPhrase('an empty "" pair')).toBe(false);
  });
});
