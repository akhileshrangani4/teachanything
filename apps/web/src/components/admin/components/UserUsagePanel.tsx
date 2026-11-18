"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import {
  CHATBOT_DAILY_MESSAGE_LIMIT,
  OWNER_DAILY_MESSAGE_LIMIT,
} from "@/lib/constants/rate-limits";
import { usageLevel } from "@/lib/usage-level";
import { UsageMeter } from "@/components/usage-meter/UsageMeter";
import { useSetUserChatbotsPaused } from "../hooks/use-set-user-chatbots-paused";
import { ChatbotStatusBadges } from "./ChatbotStatusBadges";
import { LimitValue } from "./LimitValue";
import { Fact, SheetSection } from "./SheetSections";
import { UsageSummary } from "./UsageSummary";
import { UserDailyLimitDialog } from "./UserDailyLimitDialog";

type AdminUser = RouterOutputs["admin"]["getUser"];

interface UserUsagePanelProps {
  userId: string;
  onOpenChatbot: (chatbotId: string) => void;
}

/** A professor's usage, limit, availability and chatbots, loaded by id. */
export function UserUsagePanel({ userId, onOpenChatbot }: UserUsagePanelProps) {
  const { data: user, isLoading } = trpc.admin.getUser.useQuery(
    { userId },
    { refetchInterval: 60_000 },
  );

  if (!user) {
    return (
      <SheetHeader>
        <SheetTitle>{isLoading ? "Loading…" : "User not found"}</SheetTitle>
      </SheetHeader>
    );
  }
  return <UserUsage user={user} onOpenChatbot={onOpenChatbot} />;
}

function UserUsage({
  user,
  onOpenChatbot,
}: {
  user: AdminUser;
  onOpenChatbot: (chatbotId: string) => void;
}) {
  const [isLimitDialogOpen, setIsLimitDialogOpen] = useState(false);
  const { setPaused, isPending } = useSetUserChatbotsPaused();
  const name = user.name || user.email;
  const limit = user.dailyMessageLimit ?? OWNER_DAILY_MESSAGE_LIMIT;
  const isAtLimit = usageLevel(user.usage.today, limit) === "full";

  return (
    <>
      <SheetHeader>
        <SheetTitle>{name}</SheetTitle>
        <SheetDescription>{user.email}</SheetDescription>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="capitalize">
            {user.status}
          </Badge>
          {user.chatbotsPaused && (
            <Badge variant="destructive">Chatbots paused</Badge>
          )}
          {isAtLimit && <Badge variant="destructive">Limit reached</Badge>}
        </div>
      </SheetHeader>

      <SheetSection title="Student messages, all chatbots">
        <UsageSummary usage={user.usage} limit={limit} />
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
          userName={name}
          dailyMessageLimit={user.dailyMessageLimit}
          usedToday={user.usage.today}
        />
      </SheetSection>

      <SheetSection title="Availability">
        <label className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-sm font-medium">
              Chatbots available to students
            </span>
            <span className="text-xs text-muted-foreground">
              When off, students of every chatbot {name} owns see &quot;This
              chatbot is currently unavailable.&quot;
            </span>
          </span>
          <Switch
            checked={!user.chatbotsPaused}
            disabled={isPending}
            onCheckedChange={(available) =>
              setPaused({ id: user.id, name }, !available)
            }
          />
        </label>
      </SheetSection>

      <SheetSection title="Chatbots">
        <OwnerChatbots
          userId={user.id}
          chatbotsPaused={user.chatbotsPaused}
          isOwnerAtLimit={isAtLimit}
          onOpenChatbot={onOpenChatbot}
        />
      </SheetSection>

      <SheetSection title="Details">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <Fact label="Institution">
            {user.institutionalAffiliation || "Not provided"}
          </Fact>
          <Fact label="Country">{user.country || "Not provided"}</Fact>
          <Fact label="Registered">
            {new Date(user.createdAt).toLocaleDateString(undefined, {
              dateStyle: "medium",
            })}
          </Fact>
        </dl>
      </SheetSection>
    </>
  );
}

function OwnerChatbots({
  userId,
  chatbotsPaused,
  isOwnerAtLimit,
  onOpenChatbot,
}: {
  userId: string;
  chatbotsPaused: boolean;
  isOwnerAtLimit: boolean;
  onOpenChatbot: (chatbotId: string) => void;
}) {
  const { data: chatbots, isLoading } = trpc.admin.getUserChatbots.useQuery(
    { userId },
    { refetchInterval: 60_000 },
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading chatbots…</p>;
  }
  if (!chatbots?.length) {
    return <p className="text-sm text-muted-foreground">No chatbots yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {chatbots.map((chatbot) => {
        const limit = chatbot.dailyMessageLimit ?? CHATBOT_DAILY_MESSAGE_LIMIT;
        return (
          <li key={chatbot.id}>
            <button
              type="button"
              onClick={() => onOpenChatbot(chatbot.id)}
              className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-sm font-medium">
                  {chatbot.name}
                </span>
                <ChatbotStatusBadges
                  paused={chatbot.paused}
                  ownerChatbotsPaused={chatbotsPaused}
                  sharingEnabled={chatbot.sharingEnabled}
                  isAtLimit={usageLevel(chatbot.usage.today, limit) === "full"}
                  isOwnerAtLimit={isOwnerAtLimit}
                />
              </span>
              <UsageMeter used={chatbot.usage.today} limit={limit} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
