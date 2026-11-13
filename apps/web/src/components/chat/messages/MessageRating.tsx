"use client";

import { ThumbsDown, ThumbsUp, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MessageRatingValue = "up" | "down";

interface MessageRatingProps {
  /** The student's current rating for this message, or null if unrated. */
  value: MessageRatingValue | null;
  onRate: (rating: MessageRatingValue) => void;
  disabled?: boolean;
  className?: string;
}

const OPTIONS: ReadonlyArray<{
  rating: MessageRatingValue;
  icon: LucideIcon;
  labelKey: "chat.message.rating.up" | "chat.message.rating.down";
}> = [
  { rating: "up", icon: ThumbsUp, labelKey: "chat.message.rating.up" },
  { rating: "down", icon: ThumbsDown, labelKey: "chat.message.rating.down" },
];

/**
 * Thumbs up / down for one assistant message. Presentational only: the caller
 * owns the value and persists it. Re-selecting the current rating is a no-op,
 * since ratings can be changed but not cleared.
 */
export function MessageRating({
  value,
  onRate,
  disabled = false,
  className,
}: MessageRatingProps) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t("chat.message.rating.group")}
      className={cn("flex items-center gap-0.5", className)}
    >
      {OPTIONS.map(({ rating, icon: Icon, labelKey }) => {
        const isSelected = value === rating;
        return (
          <Button
            key={rating}
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t(labelKey)}
            aria-pressed={isSelected}
            title={t(labelKey)}
            disabled={disabled}
            onClick={() => {
              if (!isSelected) onRate(rating);
            }}
            className={cn(
              "h-7 w-7 text-muted-foreground hover:bg-transparent hover:text-foreground",
              isSelected && "text-foreground",
            )}
          >
            <Icon
              className="h-3.5 w-3.5"
              fill={isSelected ? "currentColor" : "none"}
              aria-hidden="true"
            />
          </Button>
        );
      })}
    </div>
  );
}
