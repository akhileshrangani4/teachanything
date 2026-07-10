"use client";

import { useState } from "react";
import type { Quiz } from "@/lib/quiz";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check, X, RotateCcw, Trophy } from "lucide-react";

interface QuizMessageProps {
  quiz: Quiz;
}

export function QuizMessage({ quiz }: QuizMessageProps) {
  const total = quiz.questions.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  // One selected answer per question; null until the student picks.
  const [selected, setSelected] = useState<(string | null)[]>(() =>
    Array(total).fill(null),
  );
  const [finished, setFinished] = useState(false);

  const question = quiz.questions[currentIndex];
  const chosen = selected[currentIndex] ?? null;
  const answered = chosen !== null;
  const isLast = currentIndex === total - 1;

  const score = selected.reduce(
    (acc, answer, idx) =>
      answer !== null && answer === quiz.questions[idx]?.correct_answer
        ? acc + 1
        : acc,
    0,
  );

  const handleSelect = (option: string) => {
    if (answered) return; // lock the answer once chosen
    setSelected((prev) => {
      const next = [...prev];
      next[currentIndex] = option;
      return next;
    });
  };

  const handleNext = () => {
    if (isLast) {
      setFinished(true);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleRetake = () => {
    setSelected(Array(total).fill(null));
    setCurrentIndex(0);
    setFinished(false);
  };

  // Schema guarantees at least one question, but the indexed access is
  // optional under strict settings -- guard so TS is satisfied.
  if (!question) return null;

  if (finished) {
    return (
      <Card className="bg-secondary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Trophy className="h-4 w-4 text-amber-500" aria-hidden="true" />
            {quiz.quiz_title}
          </CardTitle>
        </CardHeader>
        <CardContent
          className="flex flex-col items-center gap-2 py-4"
          role="status"
          aria-live="polite"
        >
          <p className="text-3xl font-bold" aria-hidden="true">
            {score}
            <span className="text-muted-foreground text-xl"> / {total}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            You answered {score} of {total} correctly.
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm" onClick={handleRetake}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Retake quiz
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="bg-secondary">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base md:text-lg">
            {quiz.quiz_title}
          </CardTitle>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Question {currentIndex + 1} of {total}
          </span>
        </div>
        <Progress
          value={((currentIndex + 1) / total) * 100}
          className="h-2"
          aria-label={`Question ${currentIndex + 1} of ${total}`}
        />
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <p className="text-sm md:text-base font-medium">{question.question}</p>

        <div
          className="flex flex-col gap-2"
          role="group"
          aria-label={question.question}
        >
          {question.options.map((option, optionIndex) => {
            const isCorrect = option === question.correct_answer;
            const isChosen = option === chosen;
            const answerState =
              answered && isCorrect
                ? " (correct answer)"
                : answered && isChosen && !isCorrect
                  ? " (your answer, incorrect)"
                  : "";

            return (
              <button
                // Composite key: options aren't guaranteed unique by the schema,
                // so option text alone can collide. Index disambiguates.
                key={`${optionIndex}-${option}`}
                type="button"
                onClick={() => handleSelect(option)}
                disabled={answered}
                aria-label={`${option}${answerState}`}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  "disabled:cursor-default",
                  !answered &&
                    "border-border/60 bg-background hover:bg-accent hover:text-accent-foreground",
                  answered &&
                    isCorrect &&
                    "border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-400",
                  answered &&
                    isChosen &&
                    !isCorrect &&
                    "border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-400",
                  answered &&
                    !isCorrect &&
                    !isChosen &&
                    "border-border/40 bg-background opacity-60",
                )}
              >
                <span>{option}</span>
                {answered && isCorrect && (
                  <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                {answered && isChosen && !isCorrect && (
                  <X className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>

        {answered && (
          <div
            className="rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-xs md:text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <span className="font-medium text-foreground">
              {chosen === question.correct_answer ? "Correct! " : "Not quite. "}
            </span>
            {question.explanation}
          </div>
        )}
      </CardContent>

      <CardFooter className="justify-end">
        <Button size="sm" onClick={handleNext} disabled={!answered}>
          {isLast ? "Finish" : "Next"}
        </Button>
      </CardFooter>
    </Card>
  );
}
