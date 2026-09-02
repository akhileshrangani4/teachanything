/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  DAY_MS,
  dateKey,
  getRangeStart,
  roundToOne,
  startOfUtcDay,
  startOfUtcWeek,
} from "@/server/routers/analytics/helpers";

describe("startOfUtcDay", () => {
  it("zeroes the time in UTC", () => {
    expect(
      startOfUtcDay(new Date("2026-08-19T13:45:12.500Z")).toISOString(),
    ).toBe("2026-08-19T00:00:00.000Z");
  });

  it("does not mutate its input", () => {
    const input = new Date("2026-08-19T13:45:12.500Z");
    startOfUtcDay(input);
    expect(input.toISOString()).toBe("2026-08-19T13:45:12.500Z");
  });
});

describe("startOfUtcWeek", () => {
  // (getUTCDay() + 6) % 7 makes the week start on MONDAY. The off-by-one that
  // this rotation exists to prevent is invisible on every day except Sunday,
  // where a naive getUTCDay() would jump forward to the coming week instead of
  // back to the one in progress. 2026-08-23 is a Sunday; 2026-08-17 is the
  // Monday of that week.
  it("returns the Monday of the week for a mid-week date", () => {
    expect(dateKey(startOfUtcWeek(new Date("2026-08-19T23:59:59Z")))).toBe(
      "2026-08-17",
    );
  });

  it("treats Sunday as the END of its week, not the start of the next", () => {
    expect(dateKey(startOfUtcWeek(new Date("2026-08-23T12:00:00Z")))).toBe(
      "2026-08-17",
    );
  });

  it("is idempotent on a Monday", () => {
    const monday = startOfUtcWeek(new Date("2026-08-17T05:00:00Z"));
    expect(startOfUtcWeek(monday).toISOString()).toBe(monday.toISOString());
  });

  it("crosses a month boundary correctly", () => {
    // 2026-09-01 is a Tuesday, so its week starts on 2026-08-31.
    expect(dateKey(startOfUtcWeek(new Date("2026-09-01T10:00:00Z")))).toBe(
      "2026-08-31",
    );
  });
});

describe("getRangeStart", () => {
  const daysBack = (range: Parameters<typeof getRangeStart>[0]) =>
    Math.round((Date.now() - getRangeStart(range).getTime()) / DAY_MS);

  it("goes back 7 days for a week", () => {
    expect(daysBack("week")).toBe(7);
  });

  it("goes back 30 days for a month", () => {
    expect(daysBack("month")).toBe(30);
  });

  it("goes back 90 days for a quarter", () => {
    expect(daysBack("quarter")).toBe(90);
  });
});

describe("dateKey", () => {
  it("formats as YYYY-MM-DD in UTC", () => {
    expect(dateKey(new Date("2026-08-19T23:59:59Z"))).toBe("2026-08-19");
  });

  it("uses the UTC day, not the local one", () => {
    expect(dateKey(new Date("2026-08-20T00:00:00Z"))).toBe("2026-08-20");
  });
});

describe("roundToOne", () => {
  it("rounds to a single decimal place", () => {
    expect(roundToOne(1.25)).toBe(1.3);
    expect(roundToOne(1.24)).toBe(1.2);
  });

  it("leaves whole numbers and zero alone", () => {
    expect(roundToOne(0)).toBe(0);
    expect(roundToOne(7)).toBe(7);
  });

  it("handles negatives", () => {
    expect(roundToOne(-1.24)).toBe(-1.2);
  });
});
