"use client";

import type { RouterOutputs } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { COMMON_QUESTIONS_PAGE_SIZE } from "./constants";

type CommonQuestionsData = RouterOutputs["analytics"]["getCommonQuestions"];

export function CommonQuestionsCard({
  isLoading,
  data,
  offset,
  onOffsetChange,
}: {
  isLoading: boolean;
  data: CommonQuestionsData | undefined;
  offset: number;
  onOffsetChange: (offset: number) => void;
}) {
  return (
    <Card className="border border-border/60 shadow-xs">
      <CardHeader>
        <CardTitle>Common Questions</CardTitle>
        <CardDescription>
          Top first messages across student sessions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
        ) : !data || data.questions.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No common questions yet
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-3">
              {data.questions.map((question, index) => (
                <div
                  key={`${question.question}-${index}`}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                    {question.count}
                  </div>
                  <p className="text-sm leading-6 break-words">
                    {question.question}
                  </p>
                </div>
              ))}
            </div>
            {data.totalCount > COMMON_QUESTIONS_PAGE_SIZE && (
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="text-xs text-muted-foreground">
                  Showing {offset + 1}-
                  {Math.min(
                    offset + COMMON_QUESTIONS_PAGE_SIZE,
                    data.totalCount,
                  )}{" "}
                  of {data.totalCount}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onOffsetChange(
                        Math.max(0, offset - COMMON_QUESTIONS_PAGE_SIZE),
                      )
                    }
                    disabled={offset === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onOffsetChange(offset + COMMON_QUESTIONS_PAGE_SIZE)
                    }
                    disabled={
                      offset + COMMON_QUESTIONS_PAGE_SIZE >= data.totalCount
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
