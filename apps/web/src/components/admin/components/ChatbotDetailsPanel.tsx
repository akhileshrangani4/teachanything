"use client";

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
import { useSetChatbotPaused } from "../hooks/use-set-chatbot-paused";
import { AuthorNameEditor } from "./AuthorNameEditor";
import { ChatbotDailyLimitControl } from "./ChatbotDailyLimitControl";
import { ChatbotStatusBadges } from "./ChatbotStatusBadges";
import { Fact, SheetSection } from "./SheetSections";
import { UsageSummary } from "./UsageSummary";

type AdminChatbot = RouterOutputs["admin"]["getChatbot"];

interface ChatbotDetailsPanelProps {
  chatbotId: string;
  currentUserId?: string;
  onOpenProfessor: (userId: string) => void;
  /** Omit to hide Delete. */
  onDelete?: (
    chatbotId: string,
    chatbotName: string,
    ownerName: string,
  ) => void;
}

/** A chatbot's usage, limits, availability and details, loaded by id. */
export function ChatbotDetailsPanel({
  chatbotId,
  ...props
}: ChatbotDetailsPanelProps) {
  const { data: chatbot, isLoading } = trpc.admin.getChatbot.useQuery(
    { chatbotId },
    { refetchInterval: 60_000 },
  );

  if (!chatbot) {
    return (
      <SheetHeader>
        <SheetTitle>{isLoading ? "Loading…" : "Chatbot not found"}</SheetTitle>
      </SheetHeader>
    );
  }
  return <ChatbotDetails chatbot={chatbot} {...props} />;
}

function ChatbotDetails({
  chatbot,
  currentUserId,
  onOpenProfessor,
  onDelete,
}: Omit<ChatbotDetailsPanelProps, "chatbotId"> & { chatbot: AdminChatbot }) {
  const { setPaused, isPending } = useSetChatbotPaused();
  const utils = trpc.useUtils();
  const ownerName = chatbot.userName || "Unknown";
  const limit = chatbot.dailyMessageLimit ?? CHATBOT_DAILY_MESSAGE_LIMIT;
  const ownerLimit =
    chatbot.ownerDailyMessageLimit ?? OWNER_DAILY_MESSAGE_LIMIT;
  const ownerPaused = chatbot.ownerChatbotsPaused ?? false;

  return (
    <>
      <SheetHeader>
        <SheetTitle>{chatbot.name}</SheetTitle>
        {chatbot.description && (
          <SheetDescription>{chatbot.description}</SheetDescription>
        )}
        <ChatbotStatusBadges
          paused={chatbot.paused}
          ownerChatbotsPaused={ownerPaused}
          sharingEnabled={chatbot.sharingEnabled}
          isAtLimit={usageLevel(chatbot.usage.today, limit) === "full"}
          isOwnerAtLimit={
            usageLevel(chatbot.ownerUsage.today, ownerLimit) === "full"
          }
        />
      </SheetHeader>

      <SheetSection title="Student messages">
        <UsageSummary usage={chatbot.usage} limit={limit} />
        <button
          type="button"
          onClick={() => onOpenProfessor(chatbot.userId)}
          className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>
            <span className="font-medium">{ownerName}</span>
            <span className="text-muted-foreground"> · all chatbots today</span>
          </span>
          <UsageMeter used={chatbot.ownerUsage.today} limit={ownerLimit} />
        </button>
      </SheetSection>

      <SheetSection title="Daily limit">
        <ChatbotDailyLimitControl
          chatbotId={chatbot.id}
          chatbotName={chatbot.name}
          dailyMessageLimit={chatbot.dailyMessageLimit}
          usedToday={chatbot.usage.today}
          ownerName={ownerName}
          ownerLimit={ownerLimit}
        />
      </SheetSection>

      <SheetSection title="Availability">
        <label className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-sm font-medium">Available to students</span>
            <span className="text-xs text-muted-foreground">
              When off, students see &quot;This chatbot is currently
              unavailable.&quot;
            </span>
          </span>
          <Switch
            checked={!chatbot.paused}
            disabled={isPending}
            onCheckedChange={(available) =>
              setPaused({ id: chatbot.id, name: chatbot.name }, !available)
            }
          />
        </label>
        {ownerPaused && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span>
              Students can&apos;t use it right now: all of {ownerName}&apos;s
              chatbots are paused.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenProfessor(chatbot.userId)}
            >
              Open {ownerName}
            </Button>
          </div>
        )}
      </SheetSection>

      <SheetSection title="Details">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <Fact label="Owner">
            {ownerName}
            <span className="block text-xs text-muted-foreground">
              {chatbot.userEmail}
            </span>
          </Fact>
          <Fact label="Model">{chatbot.model.split("/").pop()}</Fact>
          <Fact label="Files">{chatbot.fileCount}</Fact>
          <Fact label="Created">
            {new Date(chatbot.createdAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </Fact>
        </dl>
      </SheetSection>

      {chatbot.userId === currentUserId && (
        <SheetSection title="Author name">
          <AuthorNameEditor
            chatbotId={chatbot.id}
            customAuthorName={chatbot.customAuthorName}
            ownerName={chatbot.userName}
            onSaved={() => void utils.admin.invalidate()}
          />
        </SheetSection>
      )}

      {onDelete && (
        <div className="mt-auto border-t pt-4">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(chatbot.id, chatbot.name, ownerName)}
          >
            Delete chatbot
          </Button>
        </div>
      )}
    </>
  );
}
