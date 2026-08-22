"use client";

import { useState } from "react";
import {
  initialQuizWidgetState,
  type Quiz,
  type QuizResponse,
} from "@/lib/quiz";
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
import { Check, X } from "lucide-react";
import { QuizSkeleton } from "./quiz-skeleton";
import { QuizReadOnlyView } from "./quiz-read-only-view";
import { QuizScoreView } from "./quiz-score-view";

export { QuizSkeleton };

interface QuizMessageProps {
  quiz: Quiz;
  /**
   * Read-only reveal (professor dashboard): show every question with its
   * correct answer + explanation inline, and no answer-taking flow. Students
   * get the default interactive widget.
   */
  readOnly?: boolean;
  /**
   * Called once when the student finishes an attempt (interactive mode only),
   * with their selected option indices + score. The parent persists it and
   * keeps it for export.
   */
  onAttempt?: (response: QuizResponse) => void;
  /**
   * The student's attempts for this quiz, oldest first. Rendered as a paginated
   * viewer in BOTH modes: beneath the answer key on the professor dashboard
   * (persisted attempts), and on the student's score screen (in-session
   * attempts) so they can page back through retakes.
   */
  attempts?: QuizResponse[];
}

export function QuizMessage({
  quiz,
  readOnly = false,
  onAttempt,
  attempts,
}: QuizMessageProps) {
  const total = quiz.questions.length;

  // Seed once from any completed attempt so a remount (e.g. the embed widget
  // hiding on a tab switch, then reopening) restores the finished quiz instead
  // of resetting to question 1. Snapshotted in a lazy initializer so later
  // `attempts` changes don't clobber an in-progress attempt.
  const [initial] = useState(() => initialQuizWidgetState(total, attempts));

  const [currentIndex, setCurrentIndex] = useState(initial.currentIndex);
  // One selected option INDEX per question; null until the student picks. We
  // track the index (not the option text) so duplicate option strings can't
  // collide and so scoring compares directly against `correct_index`.
  const [selected, setSelected] = useState<(number | null)[]>(initial.selected);
  const [finished, setFinished] = useState(initial.finished);

  const question = quiz.questions[currentIndex];
  const chosen = selected[currentIndex] ?? null;
  const answered = chosen !== null;
  const isLast = currentIndex === total - 1;

  const score = selected.reduce<number>(
    (acc, answerIndex, idx) =>
      answerIndex !== null && answerIndex === quiz.questions[idx]?.correct_index
        ? acc + 1
        : acc,
    0,
  );

  const handleSelect = (optionIndex: number) => {
    if (answered) return; // lock the answer once chosen
    setSelected((prev) => {
      const next = [...prev];
      next[currentIndex] = optionIndex;
      return next;
    });
  };

  const handleNext = () => {
    if (isLast) {
      // Report the completed attempt once. Every question is answered by now
      // (Next/Finish is disabled until the current one is), so `selected` has no
      // nulls; guard anyway so a bad state can't send a malformed attempt.
      if (!finished && selected.every((s) => s !== null)) {
        onAttempt?.({ answers: selected as number[], score, total });
      }
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

  if (readOnly) {
    return <QuizReadOnlyView quiz={quiz} attempts={attempts} />;
  }

  if (finished) {
    return (
      <QuizScoreView
        quiz={quiz}
        score={score}
        total={total}
        attempts={attempts}
        onRetake={handleRetake}
      />
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
            const isCorrect = optionIndex === question.correct_index;
            const isChosen = optionIndex === chosen;
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
                onClick={() => handleSelect(optionIndex)}
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
              {chosen === question.correct_index ? "Correct! " : "Not quite. "}
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
