"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CHATBOT_DAILY_MESSAGE_LIMIT } from "@/lib/constants/rate-limits";
import { DailyLimitDialog } from "./DailyLimitDialog";
import { LimitValue } from "./LimitValue";

interface ChatbotDailyLimitControlProps {
  chatbotId: string;
  chatbotName: string;
  /** The admin override, or null when the default applies. */
  dailyMessageLimit: number | null;
  onRefetch: () => void;
}

/** Shows a chatbot's daily message limit and lets an admin change it. */
export function ChatbotDailyLimitControl({
  chatbotId,
  chatbotName,
  dailyMessageLimit,
  onRefetch,
}: ChatbotDailyLimitControlProps) {
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
    <div className="flex items-center justify-between gap-2">
      <LimitValue
        limit={dailyMessageLimit}
        defaultLimit={CHATBOT_DAILY_MESSAGE_LIMIT}
      />
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        Change
      </Button>
      <DailyLimitDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Daily message limit"
        description={`Student messages "${chatbotName}" may receive per day. Its owner's daily total still applies, so raise that too if needed.`}
        defaultLimit={CHATBOT_DAILY_MESSAGE_LIMIT}
        currentLimit={dailyMessageLimit}
        isPending={setLimit.isPending}
        onSave={(limit) => setLimit.mutate({ chatbotId, limit })}
      />
    </div>
  );
}
