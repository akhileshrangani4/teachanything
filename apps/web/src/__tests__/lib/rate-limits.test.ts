import { describe, it, expect } from "@jest/globals";
import {
  CRAWL_SOURCES_PER_HOUR,
  MANUAL_URLS_PER_HOUR,
  RECRAWLS_PER_HOUR,
  formatRetryAfter,
} from "@/lib/constants/rate-limits";

const NOW = 1_700_000_000_000;

describe("formatRetryAfter", () => {
  it("rounds a partial minute up", () => {
    expect(formatRetryAfter(NOW + 90_000, NOW)).toBe("2 minutes");
  });

  it("reports a full hour", () => {
    expect(formatRetryAfter(NOW + 60 * 60_000, NOW)).toBe("60 minutes");
  });

  it("singularizes one minute", () => {
    expect(formatRetryAfter(NOW + 60_000, NOW)).toBe("1 minute");
  });

  it("clamps a sub-minute remainder to one minute", () => {
    expect(formatRetryAfter(NOW + 5_000, NOW)).toBe("1 minute");
  });

  it("clamps a reset that has already passed", () => {
    expect(formatRetryAfter(NOW - 120_000, NOW)).toBe("1 minute");
  });

  it("clamps a missing reset timestamp", () => {
    expect(formatRetryAfter(0, NOW)).toBe("1 minute");
  });
});

describe("hourly web source limits", () => {
  it("keeps the numbers the dashboard copy advertises", () => {
    expect(CRAWL_SOURCES_PER_HOUR).toBe(5);
    expect(MANUAL_URLS_PER_HOUR).toBe(20);
    expect(RECRAWLS_PER_HOUR).toBe(5);
  });
});
