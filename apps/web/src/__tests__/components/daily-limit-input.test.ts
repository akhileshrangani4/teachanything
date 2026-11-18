import { describe, it, expect } from "@jest/globals";
import { parseDailyLimitInput } from "@/components/admin/utils/daily-limit-input";

describe("parseDailyLimitInput", () => {
  it.each(["", "   "])("treats %j as the default", (value) => {
    expect(parseDailyLimitInput(value)).toEqual({ ok: true, limit: null });
  });

  it.each([
    ["1", 1],
    [" 500 ", 500],
    ["10000", 10_000],
  ])("accepts %j", (value, limit) => {
    expect(parseDailyLimitInput(value)).toEqual({ ok: true, limit });
  });

  it.each(["0", "10001", "-5", "1.5", "1e3", "abc"])("rejects %j", (value) => {
    expect(parseDailyLimitInput(value)).toEqual({ ok: false });
  });
});
