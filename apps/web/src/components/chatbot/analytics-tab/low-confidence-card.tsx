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

type LowConfidenceData = RouterOutputs["analytics"]["getLowConfidenceQueries"];

export function LowConfidenceCard({
  isLoading,
  data,
}: {
  isLoading: boolean;
  data: LowConfidenceData | undefined;
}) {
  return (
    <Card className="border border-border/60 shadow-xs">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          Low-Confidence Queries
        </CardTitle>
        <CardDescription>Messages that did not use RAG context</CardDescription>
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
            No low-confidence queries found
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
                    {new Date(query.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  {query.sessionId && (
                    <span>Session {query.sessionId.slice(0, 8)}...</span>
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
