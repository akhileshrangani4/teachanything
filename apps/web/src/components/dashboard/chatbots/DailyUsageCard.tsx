"use client";

import { useTranslation } from "react-i18next";
import { Gauge, PauseCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { UsageMeter } from "@/components/usage-meter/UsageMeter";
import { CHATBOT_DAILY_MESSAGE_LIMIT } from "@/lib/constants/rate-limits";
import { usageLevel } from "@/lib/usage-level";
import type { RouterOutputs } from "@/lib/trpc";

type DailyUsage = RouterOutputs["chatbot"]["getDailyUsage"]["total"];

const LIMITS_DOCS_URL = "/docs/instructors/daily-message-limits";

/**
 * The instructor's student messages today across all their chatbots, against
 * their daily limit, with how the limits work. Warns when an admin paused
 * their chatbots.
 */
export function DailyUsageCard({ usage }: { usage: DailyUsage }) {
  const { t } = useTranslation();
  const isFull = usageLevel(usage.today, usage.limit) === "full";

  return (
    <div className="flex flex-col gap-3">
      {usage.paused && (
        <Alert variant="destructive">
          <PauseCircle className="h-4 w-4" />
          <AlertTitle>{t("chatbots.usage.pausedTitle")}</AlertTitle>
          <AlertDescription>
            {t("chatbots.usage.pausedDescription")}
          </AlertDescription>
        </Alert>
      )}
      <Card className="border border-border/60 shadow-xs">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Gauge className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold text-foreground">
                {t("chatbots.usage.title")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("chatbots.usage.resets", {
                  chatbotLimit: CHATBOT_DAILY_MESSAGE_LIMIT,
                  limit: usage.limit,
                })}{" "}
                <a
                  href={LIMITS_DOCS_URL}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t("chatbots.usage.learnMore")}
                </a>
              </p>
              {isFull && (
                <p className="text-sm font-medium text-destructive">
                  {t("chatbots.usage.limitReached")}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1 sm:items-end">
            <UsageMeter
              used={usage.today}
              limit={usage.limit}
              label={t("chatbots.usage.meterLabel", {
                used: usage.today,
                limit: usage.limit,
              })}
              className="w-40"
            />
            <span className="text-xs text-muted-foreground">
              {t("chatbots.usage.total")}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
