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
  usedToday: number;
  ownerName: string;
  /** The professor's daily total that also applies to this chatbot. */
  ownerLimit: number;
}

/** Shows a chatbot's daily message limit and lets an admin change it. */
export function ChatbotDailyLimitControl({
  chatbotId,
  chatbotName,
  dailyMessageLimit,
  usedToday,
  ownerName,
  ownerLimit,
}: ChatbotDailyLimitControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const utils = trpc.useUtils();
  const setLimit = trpc.admin.setChatbotDailyLimit.useMutation({
    onSuccess: () => {
      setIsOpen(false);
      void utils.admin.invalidate();
      toast.success(`Daily limit updated for "${chatbotName}"`);
    },
    onError: (error) => {
      toast.error("Failed to update daily limit", {
        description: error.message,
      });
    },
  });
  const effectiveLimit = dailyMessageLimit ?? CHATBOT_DAILY_MESSAGE_LIMIT;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <LimitValue
          limit={dailyMessageLimit}
          defaultLimit={CHATBOT_DAILY_MESSAGE_LIMIT}
        />
        <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
          Change
        </Button>
      </div>
      {effectiveLimit > ownerLimit && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {ownerName}&apos;s daily total is {ownerLimit.toLocaleString()}, so
          this chatbot stops there. Raise {ownerName}&apos;s limit too.
        </p>
      )}
      <DailyLimitDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Daily message limit"
        description={`Maximum student messages per day for "${chatbotName}". ${ownerName}'s daily total (${ownerLimit.toLocaleString()} across all their chatbots) still applies.`}
        defaultLimit={CHATBOT_DAILY_MESSAGE_LIMIT}
        currentLimit={dailyMessageLimit}
        usedToday={usedToday}
        isPending={setLimit.isPending}
        onSave={(limit) => setLimit.mutate({ chatbotId, limit })}
      />
    </div>
  );
}
