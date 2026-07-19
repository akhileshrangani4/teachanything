import { X, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportChatAsText } from "@/lib/export-chat";
import { toast } from "sonner";
import type { StudyUIMessage } from "@/server/chat/study-tools";
import type { StudyResponsePayload } from "@/lib/submit-study-response";

interface EmbedHeaderProps {
  chatbotName: string;
  messagesCount: number;
  isStreaming: boolean;
  onReset: () => void;
  onClose: () => void;
  messages: StudyUIMessage[];
  /** Student's own study-tool attempts by toolCallId, included in the export. */
  studyAttempts?: Record<string, StudyResponsePayload[]>;
}

export function EmbedHeader({
  chatbotName,
  messagesCount,
  isStreaming,
  onReset,
  onClose,
  messages,
  studyAttempts,
}: EmbedHeaderProps) {
  const handleExportChat = () => {
    if (messages.length === 0) {
      toast.info("No messages to export");
      return;
    }

    try {
      exportChatAsText(messages, chatbotName, { studyAttempts });
      toast.success("Chat exported successfully");
    } catch (error) {
      toast.error("Failed to export chat", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <div className="flex items-center justify-between px-2 md:px-4 py-2 md:py-3 border-b border-border bg-muted/50 flex-shrink-0">
      <h3 className="text-xs md:text-sm font-semibold text-foreground truncate max-w-[120px] md:max-w-none">
        {chatbotName}
      </h3>
      <div className="flex items-center gap-1 md:gap-2">
        {messagesCount > 0 && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportChat}
              disabled={isStreaming}
              aria-label="Export chat"
              className="h-7 md:h-8 px-2 md:px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background border-border/50 hover:border-border transition-all duration-200"
            >
              <Download className="h-3.5 w-3.5 md:mr-1.5" aria-hidden="true" />
              <span className="hidden md:inline">Export Chat</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              disabled={isStreaming}
              aria-label="New chat"
              className="h-7 md:h-8 px-2 md:px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background border-border/50 hover:border-border transition-all duration-200"
            >
              <RotateCcw className="h-3.5 w-3.5 md:mr-1.5" aria-hidden="true" />
              <span className="hidden md:inline">New Chat</span>
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7 hover:bg-muted-foreground"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
