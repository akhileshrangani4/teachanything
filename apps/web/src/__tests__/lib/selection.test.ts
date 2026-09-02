import { describe, expect, it } from "@jest/globals";
import { toggleAllInSet, toggleInSet } from "@/lib/selection";

describe("toggleInSet", () => {
  it("adds a missing value", () => {
    expect(toggleInSet(new Set(["a"]), "b")).toEqual(new Set(["a", "b"]));
  });

  it("removes an existing value", () => {
    expect(toggleInSet(new Set(["a", "b"]), "a")).toEqual(new Set(["b"]));
  });

  it("does not mutate the original set", () => {
    const original = new Set(["a"]);
    toggleInSet(original, "b");
    expect(original).toEqual(new Set(["a"]));
  });

  it("works with non-string values", () => {
    expect(toggleInSet(new Set([1, 2]), 3)).toEqual(new Set([1, 2, 3]));
  });
});

describe("toggleAllInSet", () => {
  it("adds all values when none are selected", () => {
    expect(toggleAllInSet(new Set(["x"]), ["a", "b"])).toEqual(
      new Set(["x", "a", "b"]),
    );
  });

  it("removes all values when every value is selected", () => {
    expect(toggleAllInSet(new Set(["a", "b", "x"]), ["a", "b"])).toEqual(
      new Set(["x"]),
    );
  });

  it("adds only the missing values when selection is partial", () => {
    expect(toggleAllInSet(new Set(["a", "x"]), ["a", "b"])).toEqual(
      new Set(["a", "b", "x"]),
    );
  });

  it("keeps unrelated selections untouched", () => {
    const next = toggleAllInSet(new Set(["keep"]), ["a"]);
    expect(next).toEqual(new Set(["keep", "a"]));
  });

  it("returns a copy for an empty value list without mutating input", () => {
    const original = new Set(["a"]);
    const next = toggleAllInSet(original, []);
    expect(next).toEqual(new Set(["a"]));
    expect(next).not.toBe(original);
    expect(original).toEqual(new Set(["a"]));
  });
});
