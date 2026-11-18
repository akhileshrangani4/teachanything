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
  usedToday: number;
}

/** Lets an admin change a professor's daily total across their chatbots. */
export function UserDailyLimitDialog({
  open,
  onOpenChange,
  userId,
  userName,
  dailyMessageLimit,
  usedToday,
}: UserDailyLimitDialogProps) {
  const utils = trpc.useUtils();
  const setLimit = trpc.admin.setUserDailyLimit.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      void utils.admin.invalidate();
      toast.success(`Daily limit updated for ${userName}`);
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
      description={`Maximum student messages per day across all of ${userName}'s chatbots. Each chatbot's own limit still applies.`}
      defaultLimit={OWNER_DAILY_MESSAGE_LIMIT}
      currentLimit={dailyMessageLimit}
      usedToday={usedToday}
      isPending={setLimit.isPending}
      onSave={(limit) => setLimit.mutate({ userId, limit })}
    />
  );
}
