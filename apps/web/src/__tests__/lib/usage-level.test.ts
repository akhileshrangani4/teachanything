import { describe, it, expect } from "@jest/globals";
import { usageLevel } from "@/lib/usage-level";

describe("usageLevel", () => {
  it.each([
    [0, 150, "normal"],
    [119, 150, "normal"],
    [120, 150, "high"],
    [149, 150, "high"],
    [150, 150, "full"],
    [170, 150, "full"],
  ] as const)("%i of %i is %s", (used, limit, level) => {
    expect(usageLevel(used, limit)).toBe(level);
  });
});
