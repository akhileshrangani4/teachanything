import { describe, it, expect } from "@jest/globals";
import en from "../../../messages/en.json";
import { createI18n } from "@/i18n/create-i18n";
import {
  formatChartDate,
  formatDurationSeconds,
} from "@/components/chatbot/analytics-tab/formatters";

const english = createI18n("en", en);

describe("formatDurationSeconds", () => {
  it.each([
    [59, "59s"],
    [90, "1m 30s"],
    [3599, "59m 59s"],
    [3600, "1h"],
    [5400, "1h 30m"],
    [7180, "1h 59m"],
    [7199, "1h 59m"],
    [7200, "2h"],
  ])("formats %i seconds as %s", (seconds, expected) => {
    expect(formatDurationSeconds(seconds, english.t)).toBe(expected);
  });
});

describe("formatChartDate", () => {
  // Without the fix this only fails where local time is behind UTC, such as the
  // Americas: Jest's sandbox cannot change the process time zone.
  it("keeps the calendar day of a date-only value", () => {
    expect(formatChartDate("2026-11-06", "en")).toBe("Nov 6");
  });
});
