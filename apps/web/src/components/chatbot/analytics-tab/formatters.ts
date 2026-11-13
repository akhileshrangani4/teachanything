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

/** Thumbs up / down totals for one chatbot over the card's reporting window. */
export interface RatingsSummary {
  up: number;
  down: number;
}

/** Share of ratings that are thumbs up (0–1), or null when nothing was rated. */
export function positiveRatingShare({
  up,
  down,
}: RatingsSummary): number | null {
  const total = up + down;
  return total > 0 ? up / total : null;
}
