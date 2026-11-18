"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { RouterOutputs } from "@/lib/trpc";
import {
  CHATBOT_DAILY_MESSAGE_LIMIT,
  OWNER_DAILY_MESSAGE_LIMIT,
} from "@/lib/constants/rate-limits";
import { useSetChatbotPaused } from "../hooks/use-set-chatbot-paused";
import { AuthorNameEditor } from "./AuthorNameEditor";
import { ChatbotDailyLimitControl } from "./ChatbotDailyLimitControl";
import { ChatbotStatusBadges } from "./ChatbotStatusBadges";
import { UsageMeter } from "@/components/usage-meter/UsageMeter";
import { UsageSummary } from "./UsageSummary";
import { Fact, SheetSection } from "./SheetSections";

type Chatbot = RouterOutputs["admin"]["getAllChatbots"]["chatbots"][number];

interface ChatbotDetailsSheetProps {
  chatbot: Chatbot | null;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string;
  onRefetch: () => void;
  onDelete: (chatbotId: string, chatbotName: string, ownerName: string) => void;
}

/** Side panel with a chatbot's usage, limits, pause switch and details. */
export function ChatbotDetailsSheet({
  chatbot,
  onOpenChange,
  currentUserId,
  onRefetch,
  onDelete,
}: ChatbotDetailsSheetProps) {
  return (
    <Sheet open={chatbot !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        {chatbot && (
          <ChatbotDetails
            chatbot={chatbot}
            isOwnChatbot={chatbot.userId === currentUserId}
            onRefetch={onRefetch}
            onDelete={onDelete}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ChatbotDetails({
  chatbot,
  isOwnChatbot,
  onRefetch,
  onDelete,
}: {
  chatbot: Chatbot;
  isOwnChatbot: boolean;
  onRefetch: () => void;
  onDelete: ChatbotDetailsSheetProps["onDelete"];
}) {
  const setPaused = useSetChatbotPaused(onRefetch);
  const ownerName = chatbot.userName || "Unknown";

  return (
    <>
      <SheetHeader>
        <SheetTitle>{chatbot.name}</SheetTitle>
        {chatbot.description && (
          <SheetDescription>{chatbot.description}</SheetDescription>
        )}
        <ChatbotStatusBadges
          paused={chatbot.paused}
          ownerChatbotsPaused={chatbot.ownerChatbotsPaused ?? false}
          sharingEnabled={chatbot.sharingEnabled}
        />
      </SheetHeader>

      <SheetSection title="Student messages">
        <UsageSummary
          usage={chatbot.usage}
          limit={chatbot.dailyMessageLimit ?? CHATBOT_DAILY_MESSAGE_LIMIT}
        />
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            {ownerName}&apos;s total today, all chatbots
          </span>
          <UsageMeter
            used={chatbot.ownerUsage.today}
            limit={chatbot.ownerDailyMessageLimit ?? OWNER_DAILY_MESSAGE_LIMIT}
          />
        </div>
      </SheetSection>

      <SheetSection title="Daily limit">
        <ChatbotDailyLimitControl
          chatbotId={chatbot.id}
          chatbotName={chatbot.name}
          dailyMessageLimit={chatbot.dailyMessageLimit}
          onRefetch={onRefetch}
        />
      </SheetSection>

      <SheetSection title="Availability">
        <label className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-sm font-medium">Paused</span>
            <span className="text-xs text-muted-foreground">
              Students see &quot;This chatbot is currently unavailable.&quot;
            </span>
          </span>
          <Switch
            checked={chatbot.paused}
            disabled={setPaused.isPending}
            onCheckedChange={(paused) =>
              setPaused.mutate({ chatbotId: chatbot.id, paused })
            }
          />
        </label>
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
            {new Date(chatbot.createdAt).toLocaleString()}
          </Fact>
        </dl>
      </SheetSection>

      {isOwnChatbot && (
        <SheetSection title="Author name">
          <AuthorNameEditor
            chatbotId={chatbot.id}
            customAuthorName={chatbot.customAuthorName}
            ownerName={chatbot.userName}
            onSaved={onRefetch}
          />
        </SheetSection>
      )}

      <div className="mt-auto border-t pt-4">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onDelete(chatbot.id, chatbot.name, ownerName)}
        >
          Delete chatbot
        </Button>
      </div>
    </>
  );
}
