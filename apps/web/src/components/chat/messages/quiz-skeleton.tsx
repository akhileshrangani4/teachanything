"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";

/**
 * Placeholder shown while the model is still streaming the quiz tool input
 * (`input-streaming`), so a quiz-in-progress reads as "building" rather than a
 * blank gap covered only by the input's Stop button.
 */
export function QuizSkeleton() {
  return (
    // The Card itself is NOT aria-hidden: the typing indicator is suppressed
    // while this shows (it counts as visible content), so "Building your quiz…"
    // is the only signal a screen-reader user gets for this phase.
    <Card className="bg-secondary">
      <CardHeader>
        <CardTitle
          className="flex items-center gap-2 text-base md:text-lg text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <Sparkles className="h-4 w-4 animate-pulse" aria-hidden="true" />
          Building your quiz…
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3" aria-hidden="true">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-5/6 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}
