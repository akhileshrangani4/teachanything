"use client";

import { useEffect, useRef, useState } from "react";
import type { Matching } from "@/lib/matching";
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
import {
  shuffleRight,
  computeAccuracy,
  type ShuffledRight,
} from "@/lib/matching-game";
import { Check, X, RotateCcw, Trophy } from "lucide-react";

interface MatchingMessageProps {
  matching: Matching;
}

export function MatchingMessage({ matching }: MatchingMessageProps) {
  const pairs = matching.pairs;
  const total = pairs.length;

  const [shuffledRight, setShuffledRight] = useState<ShuffledRight[]>(() =>
    shuffleRight(pairs),
  );
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(() => new Set());
  const [wrong, setWrong] = useState<{ left: number; right: number } | null>(
    null,
  );
  const [attempts, setAttempts] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending wrong-flash timer on unmount to avoid leaks/races.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const finished = matched.size === total;

  const handleLeftClick = (left: number) => {
    // Ignore input while a wrong-match flash is animating: the 600ms timer is
    // about to clear the selection, so accepting clicks here would flicker the
    // board and let a fast clicker re-select mid-flash.
    if (wrong !== null) return;
    if (matched.has(left)) return;
    setSelectedLeft(left);
  };

  const handleRightClick = (right: number) => {
    // Same flash-window guard as the left column. Without it, repeated clicks
    // during the 600ms flash inflate `attempts` (corrupting first-try accuracy)
    // and can fire a second setWrong before the first clears.
    if (wrong !== null) return;
    if (matched.has(right)) return;
    if (selectedLeft === null) return;
    setAttempts((a) => a + 1);

    if (right === selectedLeft) {
      setMatched((prev) => {
        const next = new Set(prev);
        next.add(right);
        return next;
      });
      setSelectedLeft(null);
      setWrong(null);
      return;
    }

    setWrong({ left: selectedLeft, right });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setWrong(null);
      setSelectedLeft(null);
    }, 600);
  };

  const handleReset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShuffledRight(shuffleRight(pairs));
    setMatched(new Set());
    setSelectedLeft(null);
    setWrong(null);
    setAttempts(0);
  };

  if (finished) {
    const accuracy = computeAccuracy(total, attempts);
    return (
      <Card className="bg-secondary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Trophy className="h-4 w-4 text-amber-500" aria-hidden="true" />
            {matching.matching_title}
          </CardTitle>
        </CardHeader>
        <CardContent
          className="flex flex-col items-center gap-2 py-4"
          role="status"
          aria-live="polite"
        >
          <p className="text-3xl font-bold" aria-hidden="true">
            {accuracy}%
          </p>
          <p className="text-sm text-muted-foreground">
            You matched all {total} pairs in {attempts} attempts ({accuracy}%
            first-try accuracy).
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Play again
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
            {matching.matching_title}
          </CardTitle>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {matched.size} of {total} matched
          </span>
        </div>
        <Progress
          value={(matched.size / total) * 100}
          className="h-2"
          aria-label={`${matched.size} of ${total} pairs matched`}
        />
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2" role="group" aria-label="Terms">
            {pairs.map((pair, left) => {
              const isMatched = matched.has(left);
              const isSelected = selectedLeft === left;
              const isWrong = wrong?.left === left;
              const state = isMatched
                ? " (matched)"
                : isSelected
                  ? " (selected)"
                  : "";
              return (
                <button
                  key={left}
                  type="button"
                  onClick={() => handleLeftClick(left)}
                  disabled={isMatched}
                  aria-label={`${pair.left}${state}`}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    "disabled:cursor-default",
                    !isMatched &&
                      !isSelected &&
                      "border-border/60 bg-background hover:bg-accent hover:text-accent-foreground",
                    isSelected &&
                      "border-primary/60 bg-primary/10 text-foreground",
                    isMatched &&
                      "border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-400 opacity-60",
                    isWrong &&
                      "border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-400",
                  )}
                >
                  <span>{pair.left}</span>
                  {isMatched && (
                    <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>

          <div
            className="flex flex-col gap-2"
            role="group"
            aria-label="Matches"
          >
            {shuffledRight.map((entry) => {
              const isMatched = matched.has(entry.pairIndex);
              const isWrong = wrong?.right === entry.pairIndex;
              const state = isMatched ? " (matched)" : "";
              return (
                <button
                  key={entry.pairIndex}
                  type="button"
                  onClick={() => handleRightClick(entry.pairIndex)}
                  disabled={isMatched}
                  aria-label={`${entry.text}${state}`}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    "disabled:cursor-default",
                    !isMatched &&
                      !isWrong &&
                      "border-border/60 bg-background hover:bg-accent hover:text-accent-foreground",
                    isMatched &&
                      "border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-400 opacity-60",
                    isWrong &&
                      "border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-400",
                  )}
                >
                  <span>{entry.text}</span>
                  {isMatched && (
                    <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  {isWrong && (
                    <X className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>

      <CardFooter className="justify-end">
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reset
        </Button>
      </CardFooter>
    </Card>
  );
}
