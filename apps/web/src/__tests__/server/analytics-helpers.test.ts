import { describe, it, expect } from "@jest/globals";
import { formatPreview } from "@/server/utils";

describe("formatPreview", () => {
  it("returns null for null input", () => {
    expect(formatPreview(null)).toBeNull();
  });

  it("returns the string unchanged when under the limit", () => {
    expect(formatPreview("hello")).toBe("hello");
  });

  it("returns the string unchanged at exactly 100 chars", () => {
    const s = "a".repeat(100);
    expect(formatPreview(s)).toBe(s);
  });

  it("truncates strings longer than 100 chars with an ellipsis", () => {
    const s = "a".repeat(150);
    const result = formatPreview(s);
    expect(result).toBe("a".repeat(100) + "...");
    expect(result?.length).toBe(103);
  });

  it("preserves empty-string semantics (falsy -> null)", () => {
    expect(formatPreview("")).toBeNull();
  });
});
