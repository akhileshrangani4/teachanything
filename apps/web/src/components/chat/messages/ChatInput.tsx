import { Button } from "@/components/ui/button";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
} from "@/components/ui/prompt-input";
import { ArrowUp, Square } from "lucide-react";
import { toast } from "sonner";
import { VALIDATION_LIMITS } from "@/lib/validation";

interface ChatInputProps {
  currentMessage: string;
  setCurrentMessage: (message: string) => void;
  isStreaming: boolean;
  onSendMessage: (e: React.FormEvent) => void;
  onStopStreaming?: () => void;
}

export function ChatInput({
  currentMessage,
  setCurrentMessage,
  isStreaming,
  onSendMessage,
  onStopStreaming,
}: ChatInputProps) {
  const messageLength = currentMessage.length;
  const maxLength = VALIDATION_LIMITS.MESSAGE_MAX_LENGTH;

  const getCounterColor = () => {
    if (messageLength >= maxLength * VALIDATION_LIMITS.MESSAGE_CRITICAL_THRESHOLD)
      return "text-destructive";
    if (messageLength >= maxLength * VALIDATION_LIMITS.MESSAGE_WARNING_THRESHOLD)
      return "text-orange-500";
    return "text-muted-foreground";
  };

  const handleSubmit = () => {
    if (!currentMessage.trim() || isStreaming) return;
    if (currentMessage.length > VALIDATION_LIMITS.MESSAGE_MAX_LENGTH) {
      toast.error(
        `Message exceeds ${VALIDATION_LIMITS.MESSAGE_MAX_LENGTH.toLocaleString()} character limit`,
      );
      return;
    }
    const event = { preventDefault: () => {} } as React.FormEvent;
    onSendMessage(event);
  };

  const handleStop = () => {
    if (onStopStreaming) {
      onStopStreaming();
    }
  };

  return (
    <div className="w-full">
      <PromptInput
        value={currentMessage}
        onValueChange={setCurrentMessage}
        onSubmit={handleSubmit}
        isLoading={isStreaming}
        className="w-full"
      >
        <div className="flex items-end gap-2 w-full">
          <PromptInputTextarea
            placeholder="Ask me anything..."
            aria-label="Type a message"
            className="flex-1 text-foreground text-base min-h-[60px] md:min-h-[120px] scrollbar-thin"
          />
          <PromptInputActions>
            {isStreaming && onStopStreaming ? (
              <Button
                type="button"
                size="icon"
                variant="destructive"
                onClick={handleStop}
                aria-label="Stop generating"
                className="h-8 w-8 md:h-9 md:w-9 rounded-full"
                title="Stop generating"
              >
                <Square className="h-3.5 w-3.5 md:h-4 md:w-4 fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={isStreaming || !currentMessage.trim()}
                onClick={handleSubmit}
                aria-label="Send message"
                className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-foreground text-background hover:bg-foreground/90"
              >
                <ArrowUp className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            )}
          </PromptInputActions>
        </div>
      </PromptInput>
      <div className="flex justify-end mt-1 px-1">
        <span className={`text-xs ${getCounterColor()}`}>
          {messageLength.toLocaleString()} / {maxLength.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
