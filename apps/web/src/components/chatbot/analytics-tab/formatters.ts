import type { TFunction } from "i18next";

export function formatDurationSeconds(seconds: number, t: TFunction): string {
  if (seconds < 60) return t("analytics.duration.seconds", { seconds });
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0
      ? t("analytics.duration.minutesSeconds", {
          minutes,
          seconds: remainingSeconds,
        })
      : t("analytics.duration.minutes", { minutes });
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes > 0
    ? t("analytics.duration.hoursMinutes", { hours, minutes })
    : t("analytics.duration.hours", { hours });
}

/** `date` is a UTC calendar day ("2026-11-06"), so it must not shift to local time. */
export function formatChartDate(date: string, locale: string): string {
  return new Date(date).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
