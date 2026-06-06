"use client";

import { useState } from "react";
import type { Flashcards } from "@/lib/flashcards";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Layers, RotateCcw } from "lucide-react";

interface FlashcardMessageProps {
  flashcards: Flashcards;
}

export function FlashcardMessage({ flashcards }: FlashcardMessageProps) {
  const total = flashcards.cards.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Schema guarantees at least one card, but the indexed access is optional
  // under strict settings -- guard so TS is satisfied.
  const card = flashcards.cards[currentIndex];
  if (!card) return null;

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === total - 1;

  const handlePrev = () => {
    if (isFirst) return;
    setIsFlipped(false);
    setCurrentIndex((i) => i - 1);
  };

  const handleNext = () => {
    if (isLast) return;
    setIsFlipped(false);
    setCurrentIndex((i) => i + 1);
  };

  const handleFlip = () => setIsFlipped((flipped) => !flipped);

  return (
    <Card className="bg-secondary">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Layers
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            {flashcards.deck_title}
          </CardTitle>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Card {currentIndex + 1} of {total}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="[perspective:1000px]">
          <button
            type="button"
            onClick={handleFlip}
            aria-pressed={isFlipped}
            aria-label={
              isFlipped
                ? `Flashcard answer: ${card.back}`
                : `Flashcard: ${card.front}. Click to reveal answer.`
            }
            className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-secondary rounded-lg"
          >
            <div
              className={cn(
                "relative h-44 [transform-style:preserve-3d] transition-transform duration-500",
                isFlipped && "[transform:rotateY(180deg)]",
              )}
            >
              {/* Front face */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg border bg-background p-4 text-center [backface-visibility:hidden]">
                <p className="text-base md:text-lg font-medium">{card.front}</p>
                <span className="text-xs text-muted-foreground">
                  click to flip
                </span>
              </div>

              {/* Back face (pre-rotated) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg border bg-background p-4 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <p className="text-sm md:text-base text-foreground">
                  {card.back}
                </p>
              </div>
            </div>
          </button>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          Card {currentIndex + 1} of {total}
        </p>
      </CardContent>

      <CardFooter className="justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrev}
          disabled={isFirst}
          aria-label="Previous card"
        >
          <ChevronLeft className="h-3.5 w-3.5 mr-1.5" />
          Prev
        </Button>
        {isFlipped && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFlipped(false)}
            aria-label="Flip back to front"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Flip back
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={isLast}
          aria-label="Next card"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </CardFooter>
    </Card>
  );
}
