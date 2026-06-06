"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { StructuredMessage } from "@/types/database";

interface ConfirmModeCardProps {
  /** Which structured tool to build on Yes (e.g. "flashcards"). */
  mode: StructuredMessage["messageType"];
  /** Human label for the prompt, e.g. "flashcard deck". */
  label: string;
  /** Best-effort topic; shown as "about <topic>" when present. */
  topic: string;
  /** The student's original message, re-sent as normal chat on No. */
  originalMessage: string;
  onYes: (mode: StructuredMessage["messageType"], topic: string) => void;
  onNo: (originalMessage: string) => void;
}

/**
 * Ephemeral confirmation card shown when the chatbot eager-detects a study-tool
 * request. Asks before generating so a misread ("don't make flashcards") or a
 * passing mention never produces an unwanted widget. Yes runs generation; No
 * answers the original message as normal chat. Buttons lock after one click so
 * the choice can't double-fire.
 */
export function ConfirmModeCard({
  mode,
  label,
  topic,
  originalMessage,
  onYes,
  onNo,
}: ConfirmModeCardProps) {
  const [chosen, setChosen] = useState(false);

  const handleYes = () => {
    if (chosen) return;
    setChosen(true);
    onYes(mode, topic);
  };

  const handleNo = () => {
    if (chosen) return;
    setChosen(true);
    onNo(originalMessage);
  };

  return (
    <Card className="bg-secondary">
      <CardHeader>
        <CardTitle className="text-sm md:text-base font-medium">
          Would you like me to make a {label}
          {topic ? ` about ${topic}` : ""}?
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs md:text-sm text-muted-foreground">
        I can build it as an interactive activity, or just answer normally.
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm" onClick={handleYes} disabled={chosen}>
          Yes, make it
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleNo}
          disabled={chosen}
        >
          No thanks
        </Button>
      </CardFooter>
    </Card>
  );
}
