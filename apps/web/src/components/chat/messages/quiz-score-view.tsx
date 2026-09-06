"use client";

import type { Quiz, QuizResponse } from "@/lib/quiz";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Trophy, RotateCcw } from "lucide-react";
import { QuizAttemptsViewer } from "./QuizAttemptsViewer";

interface QuizScoreViewProps {
  quiz: Quiz;
  score: number;
  total: number;
  attempts?: QuizResponse[];
  onRetake: () => void;
}

export function QuizScoreView({
  quiz,
  score,
  total,
  attempts,
  onRetake,
}: QuizScoreViewProps) {
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
      {attempts && attempts.length > 0 && (
        <CardContent className="pt-0">
          <QuizAttemptsViewer
            quiz={quiz}
            attempts={attempts}
            label="Your answers"
          />
        </CardContent>
      )}
      <CardFooter>
        <Button variant="outline" size="sm" onClick={onRetake}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Retake quiz
        </Button>
      </CardFooter>
    </Card>
  );
}
