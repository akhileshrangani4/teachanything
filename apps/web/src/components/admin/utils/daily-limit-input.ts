import { MAX_DAILY_MESSAGE_LIMIT } from "@/lib/constants/rate-limits";

/**
 * Read the admin's daily limit field: empty means "use the default" (null),
 * otherwise a whole number from 0 (paused) to `MAX_DAILY_MESSAGE_LIMIT`.
 */
export function parseDailyLimitInput(
  value: string,
): { ok: true; limit: number | null } | { ok: false } {
  const trimmed = value.trim();
  if (trimmed === "") return { ok: true, limit: null };
  if (!/^\d+$/.test(trimmed)) return { ok: false };
  const limit = Number(trimmed);
  return limit <= MAX_DAILY_MESSAGE_LIMIT ? { ok: true, limit } : { ok: false };
}
