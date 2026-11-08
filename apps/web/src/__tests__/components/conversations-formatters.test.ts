import { describe, it, expect } from "@jest/globals";
import { formatDuration, formatTimestamp } from "@/lib/conversation-format";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { createI18n } from "@/i18n/create-i18n";

const { t } = createI18n("en", en);
const french = createI18n("fr", fr, en);

describe("formatDuration", () => {
  it("returns '-' when either endpoint is missing", () => {
    expect(formatDuration(null, new Date(), t)).toBe("-");
    expect(formatDuration(new Date(), null, t)).toBe("-");
    expect(formatDuration(null, null, t)).toBe("-");
  });

  it("formats sub-minute ranges in seconds", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-01T00:00:30Z");
    expect(formatDuration(start, end, t)).toBe("30s");
  });

  it("formats sub-hour ranges in minutes", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-01T00:05:00Z");
    expect(formatDuration(start, end, t)).toBe("5m");
  });

  it("formats multi-hour ranges as 'Xh Ym'", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-01T02:30:00Z");
    expect(formatDuration(start, end, t)).toBe("2h 30m");
  });

  it("clamps negative durations (clock skew) to 0", () => {
    const start = new Date("2026-01-01T00:05:00Z");
    const end = new Date("2026-01-01T00:00:00Z"); // before start
    expect(formatDuration(start, end, t)).toBe("0s");
  });

  it("accepts ISO strings via new Date()", () => {
    expect(
      formatDuration(
        new Date("2026-01-01T00:00:00Z"),
        new Date("2026-01-01T00:00:45Z"),
        t,
      ),
    ).toBe("45s");
  });
});

describe("formatTimestamp", () => {
  it("returns a time string for same-day timestamps", () => {
    const now = new Date();
    const result = formatTimestamp(now, t, "en");
    // H:MM AM/PM or HH:MM depending on locale — just confirm it's a time.
    expect(result).toMatch(/\d/);
    expect(result).not.toBe("Yesterday");
  });

  it("returns 'Yesterday' for exactly one day ago", () => {
    const yesterday = new Date(Date.now() - 86400000 - 60000);
    expect(formatTimestamp(yesterday, t, "en")).toBe("Yesterday");
  });

  it("returns 'N days ago' for within-week timestamps", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000 - 60000);
    expect(formatTimestamp(threeDaysAgo, t, "en")).toBe("3 days ago");
  });

  it("translates the relative branches", () => {
    const yesterday = new Date(Date.now() - 86400000 - 60000);
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000 - 60000);
    expect(formatTimestamp(yesterday, french.t, "fr")).toBe("Hier");
    expect(formatTimestamp(threeDaysAgo, french.t, "fr")).toBe(
      "Il y a 3 jours",
    );
  });

  it("formats older timestamps as a locale date", () => {
    const old = new Date(Date.now() - 10 * 86400000);
    const result = formatTimestamp(old, t, "en");
    // Should not match the relative branches.
    expect(result).not.toBe("Yesterday");
    expect(result).not.toMatch(/^\d+ days ago$/);
  });
});
