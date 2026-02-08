"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Plus } from "lucide-react";

interface EmptyChatbotsStateProps {
  onCreateClick: () => void;
}

export function EmptyChatbotsState({ onCreateClick }: EmptyChatbotsStateProps) {
  return (
    <Card className="border-2 border-dashed">
      <CardContent className="p-8 md:p-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
          <Bot className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No chatbots yet</h3>
        <p className="text-muted-foreground mb-6">
          Get started by creating your first AI chatbot
        </p>
        <Button onClick={onCreateClick} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Create Your First Chatbot
        </Button>
      </CardContent>
    </Card>
  );
}
