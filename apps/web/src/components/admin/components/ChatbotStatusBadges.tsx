import { Badge } from "@/components/ui/badge";

interface ChatbotStatusBadgesProps {
  paused: boolean;
  ownerChatbotsPaused: boolean;
  sharingEnabled: boolean;
}

/** Whether students can use a chatbot: active, paused, or paused via owner. */
export function ChatbotStatusBadges({
  paused,
  ownerChatbotsPaused,
  sharingEnabled,
}: ChatbotStatusBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {paused ? (
        <Badge variant="destructive" className="whitespace-nowrap">
          Paused
        </Badge>
      ) : ownerChatbotsPaused ? (
        <Badge variant="destructive" className="whitespace-nowrap">
          Owner paused
        </Badge>
      ) : (
        <Badge variant="secondary">Active</Badge>
      )}
      {!sharingEnabled && (
        <Badge variant="outline" className="text-muted-foreground">
          Private
        </Badge>
      )}
    </div>
  );
}
