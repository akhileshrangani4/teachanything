import { describe, it, expect } from "@jest/globals";
import {
  formatDuration,
  formatTimestamp,
} from "@/components/chatbot/ConversationsTab";

describe("formatDuration", () => {
  it("returns '-' when either endpoint is missing", () => {
    expect(formatDuration(null, new Date())).toBe("-");
    expect(formatDuration(new Date(), null)).toBe("-");
    expect(formatDuration(null, null)).toBe("-");
  });

  it("formats sub-minute ranges in seconds", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-01T00:00:30Z");
    expect(formatDuration(start, end)).toBe("30s");
  });

  it("formats sub-hour ranges in minutes", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-01T00:05:00Z");
    expect(formatDuration(start, end)).toBe("5m");
  });

  it("formats multi-hour ranges as 'Xh Ym'", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-01T02:30:00Z");
    expect(formatDuration(start, end)).toBe("2h 30m");
  });

  it("clamps negative durations (clock skew) to 0", () => {
    const start = new Date("2026-01-01T00:05:00Z");
    const end = new Date("2026-01-01T00:00:00Z"); // before start
    expect(formatDuration(start, end)).toBe("0s");
  });

  it("accepts ISO strings via new Date()", () => {
    expect(
      formatDuration(
        new Date("2026-01-01T00:00:00Z"),
        new Date("2026-01-01T00:00:45Z"),
      ),
    ).toBe("45s");
  });
});

describe("formatTimestamp", () => {
  it("returns a time string for same-day timestamps", () => {
    const now = new Date();
    const result = formatTimestamp(now);
    // H:MM AM/PM or HH:MM depending on locale — just confirm it's a time.
    expect(result).toMatch(/\d/);
    expect(result).not.toBe("Yesterday");
  });

  it("returns 'Yesterday' for exactly one day ago", () => {
    const yesterday = new Date(Date.now() - 86400000 - 60000);
    expect(formatTimestamp(yesterday)).toBe("Yesterday");
  });

  it("returns 'N days ago' for within-week timestamps", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000 - 60000);
    expect(formatTimestamp(threeDaysAgo)).toBe("3 days ago");
  });

  it("formats older timestamps as a locale date", () => {
    const old = new Date(Date.now() - 10 * 86400000);
    const result = formatTimestamp(old);
    // Should not match the relative branches.
    expect(result).not.toBe("Yesterday");
    expect(result).not.toMatch(/^\d+ days ago$/);
  });
});
