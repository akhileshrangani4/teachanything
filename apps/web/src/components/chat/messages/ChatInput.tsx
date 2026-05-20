import { Button } from "@/components/ui/button";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
} from "@/components/ui/prompt-input";
import { ArrowUp, Square } from "lucide-react";
import { toast } from "sonner";
import { useRef } from "react";
import { VALIDATION_LIMITS } from "@/lib/validation";
import { VoiceInputButton } from "./VoiceInputButton";

interface ChatInputProps {
  currentMessage: string;
  setCurrentMessage: (message: string) => void;
  isStreaming: boolean;
  onSendMessage: (e: React.FormEvent) => void;
  onStopStreaming?: () => void;
  /** When set, voice input posts to /api/transcribe with this shareToken. */
  shareToken?: string;
  /** Chatbot ID forwarded to /api/transcribe for analytics. */
  chatbotId?: string;
  /** Hide voice input on surfaces where mic capture is unreliable (e.g. embeds). */
  voiceInputEnabled?: boolean;
}

export function ChatInput({
  currentMessage,
  setCurrentMessage,
  isStreaming,
  onSendMessage,
  onStopStreaming,
  shareToken,
  chatbotId,
  voiceInputEnabled = true,
}: ChatInputProps) {
  // Ref to the textarea so handleTranscript can read the current DOM value,
  // avoiding closure over a stale currentMessage prop if the user types
  // while transcription is in-flight.
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Global kill switch — when off, voice is hidden everywhere regardless
  // of the per-surface prop. Must match the server-side check in the
  // /api/transcribe route or users see a button that always 404s.
  const voiceFeatureFlag =
    process.env.NEXT_PUBLIC_VOICE_INPUT_ENABLED !== "false";
  const showVoiceInput = voiceFeatureFlag && voiceInputEnabled;
  const messageLength = currentMessage.length;
  const maxLength = VALIDATION_LIMITS.MESSAGE_MAX_LENGTH;

  const getCounterColor = () => {
    if (
      messageLength >=
      maxLength * VALIDATION_LIMITS.MESSAGE_CRITICAL_THRESHOLD
    )
      return "text-destructive";
    if (
      messageLength >=
      maxLength * VALIDATION_LIMITS.MESSAGE_WARNING_THRESHOLD
    )
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

  const handleTranscript = (text: string) => {
    // Read current textarea value instead of relying on currentMessage prop closure,
    // which may be stale if the user typed while transcription was in-flight.
    const current = textareaRef.current?.value ?? "";
    const next =
      current.trim().length === 0
        ? text
        : `${current.replace(/\s+$/, "")} ${text}`;
    const capped = next.slice(0, VALIDATION_LIMITS.MESSAGE_MAX_LENGTH);
    setCurrentMessage(capped);
    if (capped.length === VALIDATION_LIMITS.MESSAGE_MAX_LENGTH) {
      toast.warning("Message truncated to character limit");
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
            ref={textareaRef}
            placeholder="Ask me anything..."
            aria-label="Type a message"
            className="flex-1 text-foreground text-base min-h-[60px] md:min-h-[120px] scrollbar-thin"
          />
          <PromptInputActions>
            {showVoiceInput && !isStreaming && (
              <VoiceInputButton
                disabled={isStreaming}
                shareToken={shareToken}
                chatbotId={chatbotId}
                onTranscript={handleTranscript}
              />
            )}
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
