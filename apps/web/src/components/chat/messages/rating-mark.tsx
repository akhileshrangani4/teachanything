"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MessageRatingValue } from "./MessageRating";

/**
 * Read-only marker for the professor's transcript: how the student rated
 * this assistant message.
 */
export function RatingMark({ rating }: { rating: MessageRatingValue }) {
  const { t } = useTranslation();
  const Icon = rating === "up" ? ThumbsUp : ThumbsDown;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
      <Icon className="h-3 w-3" fill="currentColor" aria-hidden="true" />
      {t(
        rating === "up"
          ? "chat.message.rating.ratedUp"
          : "chat.message.rating.ratedDown",
      )}
    </span>
  );
}
