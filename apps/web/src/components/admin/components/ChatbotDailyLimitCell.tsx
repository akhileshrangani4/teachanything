"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CHATBOT_DAILY_MESSAGE_LIMIT } from "@/lib/constants/rate-limits";
import { DailyLimitDialog } from "./DailyLimitDialog";

interface ChatbotDailyLimitCellProps {
  chatbotId: string;
  chatbotName: string;
  /** The admin override, or null when the default applies. */
  dailyMessageLimit: number | null;
  /** Paused by an admin, directly or through its owner. */
  paused: boolean;
  ownerChatbotsPaused: boolean;
  onRefetch: () => void;
}

/** Shows a chatbot's daily message limit and lets an admin change it. */
export function ChatbotDailyLimitCell({
  chatbotId,
  chatbotName,
  dailyMessageLimit,
  paused,
  ownerChatbotsPaused,
  onRefetch,
}: ChatbotDailyLimitCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const setLimit = trpc.admin.setChatbotDailyLimit.useMutation({
    onSuccess: () => {
      setIsOpen(false);
      onRefetch();
      toast.success("Daily limit updated");
    },
    onError: (error) => {
      toast.error("Failed to update daily limit", {
        description: error.message,
      });
    },
  });

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-auto px-2 py-1 -mx-2 flex flex-col items-start gap-0"
        onClick={() => setIsOpen(true)}
        title="Change this chatbot's daily message limit"
      >
        <span className="text-sm font-medium">
          {dailyMessageLimit ?? CHATBOT_DAILY_MESSAGE_LIMIT}/day
        </span>
        <span className="text-xs text-muted-foreground">
          {dailyMessageLimit === null ? "Default" : "Custom"}
        </span>
      </Button>
      {(paused || ownerChatbotsPaused) && (
        <Badge
          variant="destructive"
          className="text-[10px] py-0 px-1.5 whitespace-nowrap"
        >
          {paused ? "Paused" : "Owner paused"}
        </Badge>
      )}
      <DailyLimitDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Daily message limit"
        description={`Student messages "${chatbotName}" may receive per day. Its owner's daily total still applies, so raise that too (Users tab) if needed.`}
        defaultLimit={CHATBOT_DAILY_MESSAGE_LIMIT}
        currentLimit={dailyMessageLimit}
        isPending={setLimit.isPending}
        onSave={(limit) => setLimit.mutate({ chatbotId, limit })}
      />
    </div>
  );
}
