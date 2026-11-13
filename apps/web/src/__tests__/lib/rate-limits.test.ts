import { describe, it, expect } from "@jest/globals";
import {
  CRAWL_SOURCES_PER_HOUR,
  MANUAL_URLS_PER_HOUR,
  RECRAWLS_PER_HOUR,
  retryAfterHours,
  retryAfterMinutes,
} from "@/lib/constants/rate-limits";

const NOW = 1_700_000_000_000;

describe("retryAfterHours", () => {
  it("rounds a partial hour up", () => {
    expect(retryAfterHours(NOW + 90 * 60_000, NOW)).toBe(2);
  });

  it("clamps a reset that has already passed", () => {
    expect(retryAfterHours(NOW - 120_000, NOW)).toBe(1);
  });
});

describe("retryAfterMinutes", () => {
  it("rounds a partial minute up", () => {
    expect(retryAfterMinutes(NOW + 90_000, NOW)).toBe(2);
  });

  it("reports a full hour", () => {
    expect(retryAfterMinutes(NOW + 60 * 60_000, NOW)).toBe(60);
  });

  it("singularizes one minute", () => {
    expect(retryAfterMinutes(NOW + 60_000, NOW)).toBe(1);
  });

  it("clamps a sub-minute remainder to one minute", () => {
    expect(retryAfterMinutes(NOW + 5_000, NOW)).toBe(1);
  });

  it("clamps a reset that has already passed", () => {
    expect(retryAfterMinutes(NOW - 120_000, NOW)).toBe(1);
  });

  it("clamps a missing reset timestamp", () => {
    expect(retryAfterMinutes(0, NOW)).toBe(1);
  });
});

describe("hourly web source limits", () => {
  it("keeps the numbers the dashboard copy advertises", () => {
    expect(CRAWL_SOURCES_PER_HOUR).toBe(5);
    expect(MANUAL_URLS_PER_HOUR).toBe(20);
    expect(RECRAWLS_PER_HOUR).toBe(5);
  });
});
