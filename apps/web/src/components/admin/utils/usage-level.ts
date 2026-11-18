/** Share of the daily limit at which usage is flagged as getting close. */
const HIGH_USAGE_RATIO = 0.8;

/** How close `used` is to `limit`: below 80%, at least 80%, or at the limit. */
export function usageLevel(
  used: number,
  limit: number,
): "normal" | "high" | "full" {
  if (used >= limit) return "full";
  if (used >= limit * HIGH_USAGE_RATIO) return "high";
  return "normal";
}
