"use client";

import { useEffect, useRef, useState } from "react";
import type { Quiz, QuizResponse } from "@/lib/quiz";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, X, ChevronLeft, ChevronRight } from "lucide-react";

interface QuizAttemptsViewerProps {
  quiz: Quiz;
  /** The student's attempts, oldest first. */
  attempts: QuizResponse[];
  /** Heading above the viewer (e.g. "Your answers" vs "Student answers"). */
  label: string;
}

/**
 * Shows ONE quiz attempt at a time (the student's pick vs the correct answer per
 * question, plus the score) with Prev/Next pagination. Opens on the latest
 * attempt. Reused by the student's score screen and the professor dashboard
 * reveal so both can page back through attempts.
 */
export function QuizAttemptsViewer({
  quiz,
  attempts,
  label,
}: QuizAttemptsViewerProps) {
  // Default to the latest attempt; clamp in case `attempts` shrinks while
  // mounted. When a NEW attempt arrives while mounted (e.g. the professor's
  // dashboard query refetches on window focus after a student retake), jump to
  // it -- the initial useState only runs once, so without this the viewer would
  // silently stay on the older attempt.
  const [index, setIndex] = useState(attempts.length - 1);
  const prevLengthRef = useRef(attempts.length);
  useEffect(() => {
    if (attempts.length > prevLengthRef.current) {
      setIndex(attempts.length - 1);
    }
    prevLengthRef.current = attempts.length;
  }, [attempts.length]);
  const current = Math.min(Math.max(index, 0), attempts.length - 1);
  const attempt = attempts[current];
  if (!attempt) return null;

  const hasPager = attempts.length > 1;

  return (
    <div className="flex flex-col gap-2 border-t border-border/50 pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{label}</p>
        {hasPager && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={current === 0}
              onClick={() => setIndex(current - 1)}
              aria-label="Previous attempt"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
              Attempt {current + 1} / {attempts.length}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={current === attempts.length - 1}
              onClick={() => setIndex(current + 1)}
              aria-label="Next attempt"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <p
        className="text-xs font-medium text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {hasPager ? `Attempt ${current + 1}: ` : ""}scored {attempt.score}/
        {attempt.total}
      </p>

      <div className="flex flex-col gap-1">
        {quiz.questions.map((q, qi) => {
          const choiceIndex = attempt.answers[qi];
          const isCorrect = choiceIndex === q.correct_index;
          const chosenText =
            typeof choiceIndex === "number" &&
            q.options[choiceIndex] !== undefined
              ? q.options[choiceIndex]
              : "(no answer)";
          return (
            <div
              key={qi}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                isCorrect
                  ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
                  : "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400",
              )}
            >
              <span className="min-w-0 truncate">
                Q{qi + 1}: {chosenText}
                <span className="sr-only">
                  {isCorrect ? " (correct)" : " (incorrect)"}
                </span>
              </span>
              {isCorrect ? (
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
