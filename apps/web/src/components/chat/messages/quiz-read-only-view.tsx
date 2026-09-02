"use client";

import type { Quiz, QuizResponse } from "@/lib/quiz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { QuizAttemptsViewer } from "./QuizAttemptsViewer";

interface QuizReadOnlyViewProps {
  quiz: Quiz;
  attempts?: QuizResponse[];
}

// Read-only reveal for the professor dashboard: every question with its
// correct answer highlighted and explanation shown, no answer submission.
export function QuizReadOnlyView({ quiz, attempts }: QuizReadOnlyViewProps) {
  return (
    <Card className="bg-secondary">
      <CardHeader>
        <CardTitle className="text-base md:text-lg">
          {quiz.quiz_title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {quiz.questions.map((q, qi) => (
          <div key={qi} className="flex flex-col gap-2">
            <p className="text-sm md:text-base font-medium">
              {qi + 1}. {q.question}
            </p>
            <div className="flex flex-col gap-2">
              {q.options.map((option, optionIndex) => {
                const isCorrect = optionIndex === q.correct_index;
                return (
                  <div
                    key={`${optionIndex}-${option}`}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm",
                      isCorrect
                        ? "border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-400"
                        : "border-border/40 bg-background opacity-70",
                    )}
                  >
                    <span>
                      {option}
                      {/* A non-interactive <div>'s aria-label is not reliably
                          announced; a real (visually hidden) text node is, so
                          screen-reader users learn which option is correct. */}
                      {isCorrect && (
                        <span className="sr-only"> (correct answer)</span>
                      )}
                    </span>
                    {isCorrect && (
                      <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-xs md:text-sm text-muted-foreground">
              {q.explanation}
            </div>
          </div>
        ))}

        {attempts && attempts.length > 0 && (
          <QuizAttemptsViewer
            quiz={quiz}
            attempts={attempts}
            label="Student answers"
          />
        )}
      </CardContent>
    </Card>
  );
}
