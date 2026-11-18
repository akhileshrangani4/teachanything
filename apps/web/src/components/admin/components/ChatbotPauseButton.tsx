"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

interface ChatbotPauseButtonProps {
  chatbotId: string;
  paused: boolean;
  onRefetch: () => void;
}

/** Turns one chatbot off for students, or back on. */
export function ChatbotPauseButton({
  chatbotId,
  paused,
  onRefetch,
}: ChatbotPauseButtonProps) {
  const setPaused = trpc.admin.setChatbotPaused.useMutation({
    onSuccess: (_data, { paused: isNowPaused }) => {
      onRefetch();
      toast.success(isNowPaused ? "Chatbot paused" : "Chatbot resumed");
    },
    onError: (error) => {
      toast.error("Failed to update chatbot", { description: error.message });
    },
  });

  return (
    <Button
      size="sm"
      variant={paused ? "default" : "outline"}
      onClick={() => setPaused.mutate({ chatbotId, paused: !paused })}
      disabled={setPaused.isPending}
      title={
        paused
          ? "Turn this chatbot back on for students"
          : "Turn this chatbot off for students"
      }
    >
      {paused ? "Resume" : "Pause"}
    </Button>
  );
}
