"use client";

import { ThumbsDown, ThumbsUp, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { positiveRatingShare, type RatingsSummary } from "./formatters";

/**
 * Professor-facing totals of student response ratings over a fixed last 30
 * days. Presentational only: the caller fetches the summary.
 */
export function RatingsCard({
  isLoading,
  data,
}: {
  isLoading: boolean;
  data: RatingsSummary | undefined;
}) {
  const { t } = useTranslation();
  const positiveShare = data ? positiveRatingShare(data) : null;

  return (
    <Card className="border border-border/60 shadow-xs">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <ThumbsUp className="h-5 w-5" aria-hidden="true" />
            {t("analytics.ratings.title")}
          </CardTitle>
          <span className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
            {t("analytics.ratings.period")}
          </span>
        </div>
        <CardDescription>{t("analytics.ratings.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded" />
            ))}
          </div>
        ) : !data || positiveShare === null ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {t("analytics.ratings.empty")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("analytics.ratings.emptyHint")}
            </p>
          </div>
        ) : (
          <dl className="grid grid-cols-3 gap-3">
            <RatingStat
              icon={ThumbsUp}
              label={t("analytics.ratings.up")}
              value={t("analytics.ratings.count", { count: data.up })}
            />
            <RatingStat
              icon={ThumbsDown}
              label={t("analytics.ratings.down")}
              value={t("analytics.ratings.count", { count: data.down })}
            />
            <RatingStat
              label={t("analytics.ratings.positive")}
              value={t("analytics.ratings.positiveValue", {
                rate: positiveShare,
              })}
            />
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function RatingStat({
  icon: Icon,
  label,
  value,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-bold">{value}</dd>
    </div>
  );
}
