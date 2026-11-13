"use client";

import type { RouterOutputs } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

type LowConfidenceData = RouterOutputs["analytics"]["getLowConfidenceQueries"];

export function LowConfidenceCard({
  isLoading,
  data,
}: {
  isLoading: boolean;
  data: LowConfidenceData | undefined;
}) {
  const { t, i18n } = useTranslation();
  return (
    <Card className="border border-border/60 shadow-xs">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          {t("analytics.lowConfidence.title")}
        </CardTitle>
        <CardDescription>
          {t("analytics.lowConfidence.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded" />
            ))}
          </div>
        ) : !data || data.queries.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {t("analytics.lowConfidence.empty")}
          </div>
        ) : (
          <div className="space-y-3">
            {data.queries.map((query) => (
              <div key={query.id} className="rounded-lg border p-3">
                <p className="text-sm leading-6 break-words">
                  {query.question}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>
                    {new Date(query.createdAt).toLocaleDateString(
                      i18n.language,
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      },
                    )}
                  </span>
                  {query.sessionId && (
                    <span>
                      {t("analytics.lowConfidence.session", {
                        id: query.sessionId.slice(0, 8),
                      })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
