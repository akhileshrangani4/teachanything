import { describe, it, expect } from "@jest/globals";
import { escapeLikePattern } from "@/server/utils";

describe("escapeLikePattern", () => {
  it("returns normal strings unchanged", () => {
    expect(escapeLikePattern("hello world")).toBe("hello world");
  });

  it("returns alphabetic strings unchanged", () => {
    expect(escapeLikePattern("abcdefg")).toBe("abcdefg");
  });

  it("returns numeric strings unchanged", () => {
    expect(escapeLikePattern("12345")).toBe("12345");
  });

  it("escapes percent sign", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
  });

  it("escapes underscore", () => {
    expect(escapeLikePattern("user_name")).toBe("user\\_name");
  });

  it("escapes both percent and underscore", () => {
    expect(escapeLikePattern("100%_done")).toBe("100\\%\\_done");
  });

  it("handles empty string", () => {
    expect(escapeLikePattern("")).toBe("");
  });

  it("escapes multiple percent signs", () => {
    expect(escapeLikePattern("%%")).toBe("\\%\\%");
  });

  it("escapes multiple underscores", () => {
    expect(escapeLikePattern("__init__")).toBe("\\_\\_init\\_\\_");
  });

  it("escapes mixed multiple wildcards", () => {
    expect(escapeLikePattern("%_hello_%_world%")).toBe(
      "\\%\\_hello\\_\\%\\_world\\%",
    );
  });

  it("does not escape backslash itself", () => {
    expect(escapeLikePattern("back\\slash")).toBe("back\\slash");
  });

  it("handles string with only wildcards", () => {
    expect(escapeLikePattern("%")).toBe("\\%");
    expect(escapeLikePattern("_")).toBe("\\_");
  });

  it("handles special regex characters without escaping them", () => {
    expect(escapeLikePattern("test.value")).toBe("test.value");
    expect(escapeLikePattern("(parens)")).toBe("(parens)");
    expect(escapeLikePattern("[brackets]")).toBe("[brackets]");
  });

  it("preserves whitespace", () => {
    expect(escapeLikePattern("  spaces  ")).toBe("  spaces  ");
    expect(escapeLikePattern("\ttab")).toBe("\ttab");
    expect(escapeLikePattern("new\nline")).toBe("new\nline");
  });

  it("handles unicode characters", () => {
    expect(escapeLikePattern("cafe\u0301")).toBe("cafe\u0301");
  });
});
