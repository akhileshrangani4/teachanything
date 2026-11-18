"use client";

import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { OWNER_DAILY_MESSAGE_LIMIT } from "@/lib/constants/rate-limits";
import { DailyLimitDialog } from "./DailyLimitDialog";

interface UserDailyLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  /** The admin override, or null when the default applies. */
  dailyMessageLimit: number | null;
}

/** Lets an admin change a professor's daily total across their chatbots. */
export function UserDailyLimitDialog({
  open,
  onOpenChange,
  userId,
  userName,
  dailyMessageLimit,
}: UserDailyLimitDialogProps) {
  const utils = trpc.useUtils();
  const setLimit = trpc.admin.setUserDailyLimit.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      void utils.admin.getAllUsers.invalidate();
      toast.success("Daily limit updated");
    },
    onError: (error) => {
      toast.error("Failed to update daily limit", {
        description: error.message,
      });
    },
  });

  return (
    <DailyLimitDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Daily message limit"
      description={`Student messages all of ${userName}'s chatbots together may receive per day. Each chatbot's own limit still applies. 0 pauses all of their chatbots.`}
      defaultLimit={OWNER_DAILY_MESSAGE_LIMIT}
      currentLimit={dailyMessageLimit}
      isPending={setLimit.isPending}
      onSave={(limit) => setLimit.mutate({ userId, limit })}
    />
  );
}
