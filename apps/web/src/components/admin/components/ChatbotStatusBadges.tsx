import { Badge } from "@/components/ui/badge";
import { chatbotBlockedReason } from "../utils/chatbot-availability";

interface ChatbotStatusBadgesProps {
  paused: boolean;
  ownerChatbotsPaused: boolean;
  sharingEnabled: boolean;
  /** The chatbot has used up its own daily limit. */
  isAtLimit?: boolean;
  /** Its professor has used up their daily total across all chatbots. */
  isOwnerAtLimit?: boolean;
}

/** Whether students can use a chatbot right now, naming why when they can't. */
export function ChatbotStatusBadges({
  paused,
  ownerChatbotsPaused,
  sharingEnabled,
  isAtLimit = false,
  isOwnerAtLimit = false,
}: ChatbotStatusBadgesProps) {
  const blockedReason = chatbotBlockedReason({
    paused,
    ownerChatbotsPaused,
    isAtLimit,
    isOwnerAtLimit,
  });

  return (
    <div className="flex flex-wrap items-center gap-1">
      {blockedReason ? (
        <Badge variant="destructive" className="whitespace-nowrap">
          {blockedReason}
        </Badge>
      ) : (
        <Badge variant="secondary">Available</Badge>
      )}
      {!sharingEnabled && (
        <Badge variant="outline" className="text-muted-foreground">
          Private
        </Badge>
      )}
    </div>
  );
}
