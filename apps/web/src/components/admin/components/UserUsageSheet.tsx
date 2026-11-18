"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import {
  CHATBOT_DAILY_MESSAGE_LIMIT,
  OWNER_DAILY_MESSAGE_LIMIT,
} from "@/lib/constants/rate-limits";
import { useSetUserChatbotsPaused } from "../hooks/use-set-user-chatbots-paused";
import { ChatbotStatusBadges } from "./ChatbotStatusBadges";
import { LimitValue } from "./LimitValue";
import { Fact, SheetSection } from "./SheetSections";
import { UsageMeter } from "./UsageMeter";
import { UsageSummary } from "./UsageSummary";
import { UserDailyLimitDialog } from "./UserDailyLimitDialog";

type AdminUser = RouterOutputs["admin"]["getAllUsers"]["users"][number];

interface UserUsageSheetProps {
  user: AdminUser | null;
  onOpenChange: (open: boolean) => void;
}

/** Side panel with a professor's usage, limit, pause switch and chatbots. */
export function UserUsageSheet({ user, onOpenChange }: UserUsageSheetProps) {
  return (
    <Sheet open={user !== null} onOpenChange={onOpenChange}>
      <SheetContent>{user && <UserUsage user={user} />}</SheetContent>
    </Sheet>
  );
}

function UserUsage({ user }: { user: AdminUser }) {
  const [isLimitDialogOpen, setIsLimitDialogOpen] = useState(false);
  const setChatbotsPaused = useSetUserChatbotsPaused();

  return (
    <>
      <SheetHeader>
        <SheetTitle>{user.name || user.email}</SheetTitle>
        <SheetDescription>{user.email}</SheetDescription>
      </SheetHeader>

      <SheetSection title="Student messages, all chatbots">
        <UsageSummary
          usage={user.usage}
          limit={user.dailyMessageLimit ?? OWNER_DAILY_MESSAGE_LIMIT}
        />
      </SheetSection>

      <SheetSection title="Daily limit">
        <div className="flex items-center justify-between gap-2">
          <LimitValue
            limit={user.dailyMessageLimit}
            defaultLimit={OWNER_DAILY_MESSAGE_LIMIT}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLimitDialogOpen(true)}
          >
            Change
          </Button>
        </div>
        <UserDailyLimitDialog
          open={isLimitDialogOpen}
          onOpenChange={setIsLimitDialogOpen}
          userId={user.id}
          userName={user.name || user.email}
          dailyMessageLimit={user.dailyMessageLimit}
        />
      </SheetSection>

      <SheetSection title="Availability">
        <label className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-sm font-medium">All chatbots paused</span>
            <span className="text-xs text-muted-foreground">
              Students of every chatbot this professor owns see &quot;This
              chatbot is currently unavailable.&quot;
            </span>
          </span>
          <Switch
            checked={user.chatbotsPaused}
            disabled={setChatbotsPaused.isPending}
            onCheckedChange={(paused) =>
              setChatbotsPaused.mutate({ userId: user.id, paused })
            }
          />
        </label>
      </SheetSection>

      <SheetSection title="Chatbots">
        <OwnerChatbots userId={user.id} chatbotsPaused={user.chatbotsPaused} />
      </SheetSection>

      <SheetSection title="Details">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <Fact label="Institution">
            {user.institutionalAffiliation || "Not provided"}
          </Fact>
          <Fact label="Country">{user.country || "Not provided"}</Fact>
          <Fact label="Registered">
            {new Date(user.createdAt).toLocaleDateString()}
          </Fact>
        </dl>
      </SheetSection>
    </>
  );
}

function OwnerChatbots({
  userId,
  chatbotsPaused,
}: {
  userId: string;
  chatbotsPaused: boolean;
}) {
  const { data: chatbots, isLoading } = trpc.admin.getUserChatbots.useQuery({
    userId,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading chatbots…</p>;
  }
  if (!chatbots?.length) {
    return <p className="text-sm text-muted-foreground">No chatbots yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {chatbots.map((chatbot) => (
        <li
          key={chatbot.id}
          className="flex items-center justify-between gap-3 p-3"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-sm font-medium">{chatbot.name}</span>
            <ChatbotStatusBadges
              paused={chatbot.paused}
              ownerChatbotsPaused={chatbotsPaused}
              sharingEnabled={chatbot.sharingEnabled}
            />
          </div>
          <UsageMeter
            used={chatbot.usage.today}
            limit={chatbot.dailyMessageLimit ?? CHATBOT_DAILY_MESSAGE_LIMIT}
          />
        </li>
      ))}
    </ul>
  );
}
