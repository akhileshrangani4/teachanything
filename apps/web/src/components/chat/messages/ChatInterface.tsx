"use client";

import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import type { StudyUIMessage } from "@/server/chat/study-tools";
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from "@/components/ui/chat-container";
import { Button } from "@/components/ui/button";
import { MessageAvatar } from "@/components/ui/message";
import { TypingLoader } from "@/components/ui/loader";
import { RotateCcw, Download } from "lucide-react";
import { exportChatAsText } from "@/lib/export-chat";
import { RETRIEVAL_PART_TYPES } from "@/lib/retrieval-tool-names";
import { toast } from "sonner";

/** Derive the live status line client-side (reasoning is never streamed). */
function deriveStatusLine(
  last: StudyUIMessage | undefined,
  isStreaming: boolean,
  isThinking: boolean,
): string {
  if (!isStreaming) return "Thinking…";
  const parts = last?.role === "assistant" ? last.parts : [];
  const lastPart = parts[parts.length - 1];
  if (lastPart && RETRIEVAL_PART_TYPES.has(lastPart.type)) {
    return "Searching documents…";
  }
  if (isThinking) return "Thinking…";
  return "Thinking…";
}

/** Does the in-flight assistant message already have visible content to render? */
function hasVisibleContent(message: StudyUIMessage | undefined): boolean {
  if (!message || message.role !== "assistant") return false;
  return message.parts.some(
    (p) =>
      (p.type === "text" && p.text.trim().length > 0) ||
      // A quiz part only renders once its input is complete (or errored);
      // while the input is still streaming, ChatMessage shows nothing, so
      // keep the typing indicator up.
      (p.type === "tool-showQuiz" &&
        (p.state === "input-available" ||
          p.state === "output-available" ||
          p.state === "output-error")),
  );
}

interface ChatInterfaceProps {
  messages: StudyUIMessage[];
  isStreaming: boolean;
  isThinking?: boolean;
  currentMessage: string;
  setCurrentMessage: (message: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  chatbotName: string;
  resetChat: () => void;
  stop?: () => void;
  height?: string;
  hideHeader?: boolean;
  embedMode?: boolean;
  showFrame?: boolean;
  showSources?: boolean;
  brandingText?: React.ReactNode;
  shareToken?: string;
  chatbotId?: string;
  voiceInputEnabled?: boolean;
}

export function ChatInterface({
  messages,
  isStreaming,
  isThinking = false,
  currentMessage,
  setCurrentMessage,
  handleSendMessage,
  messagesEndRef,
  chatbotName,
  resetChat,
  stop,
  height = "h-[600px]",
  hideHeader = false,
  embedMode = false,
  showFrame,
  showSources = false,
  brandingText,
  shareToken,
  chatbotId,
  voiceInputEnabled = true,
}: ChatInterfaceProps) {
  const lastMessage = messages[messages.length - 1];
  // Show the typing/status indicator while streaming until the assistant
  // message has visible content of its own (text or a rendered study tool).
  const showIndicator = isStreaming && !hasVisibleContent(lastMessage);
  const statusLine = deriveStatusLine(lastMessage, isStreaming, isThinking);

  return (
    <div
      className={`flex flex-col ${height} ${(showFrame ?? !embedMode) ? "border rounded-lg" : ""} bg-background overflow-hidden`}
      style={{
        height: height === "h-full" ? "100%" : undefined,
        maxHeight: "100%",
      }}
    >
      {/* Header */}
      {!hideHeader && (brandingText || messages.length > 0) && (
        <div className="flex items-center gap-2 px-2 md:px-4 py-2 md:py-2.5 border-b bg-muted/30 flex-shrink-0">
          {brandingText && (
            <p className="text-xs text-muted-foreground">{brandingText}</p>
          )}
          <div className="ml-auto flex items-center gap-2">
            {messages.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    try {
                      exportChatAsText(messages, chatbotName);
                      toast.success("Chat exported successfully");
                    } catch (error) {
                      toast.error("Failed to export chat", {
                        description:
                          error instanceof Error
                            ? error.message
                            : "Unknown error",
                      });
                    }
                  }}
                  disabled={isStreaming}
                  className="h-8 px-2 md:px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background border-border/50 hover:border-border transition-all duration-200"
                >
                  <Download className="h-3.5 w-3.5 md:mr-1.5" />
                  <span className="hidden md:inline">Export Chat</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetChat}
                  disabled={isStreaming}
                  className="h-8 px-2 md:px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background border-border/50 hover:border-border transition-all duration-200"
                >
                  <RotateCcw className="h-3.5 w-3.5 md:mr-1.5" />
                  <span className="hidden md:inline">New Chat</span>
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <ChatContainerRoot
          className={`flex-1 min-h-0 overflow-y-auto ${embedMode ? "scrollbar-embed" : ""}`}
          aria-live="polite"
          aria-label="Chat messages"
          aria-busy={isStreaming}
        >
          <ChatContainerContent className="p-2 md:p-3">
            {messages.length === 0 && !isStreaming ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8 md:py-12 px-4">
                <p className="text-muted-foreground mb-2 text-base md:text-lg">
                  👋 Welcome to {chatbotName}!
                </p>
                <p className="text-xs md:text-sm text-muted-foreground/70">
                  Start by asking a question about the course.
                </p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    showSources={showSources}
                  />
                ))}
                {showIndicator && (
                  <div className="flex gap-2 md:gap-3 items-start">
                    <MessageAvatar
                      src="/logo.svg"
                      alt="Teach Anything™"
                      imageClassName="grayscale"
                    />
                    <div className="bg-secondary rounded-xl md:rounded-lg px-3 py-2 md:px-4 md:py-3 w-fit shadow-xs border border-border/50">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                        <TypingLoader size="sm" className="opacity-60" />
                        <span>{statusLine}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <ChatContainerScrollAnchor ref={messagesEndRef} />
          </ChatContainerContent>
        </ChatContainerRoot>
      </div>

      {/* Input */}
      <div className="p-2 md:p-4 border-t flex-shrink-0">
        <ChatInput
          currentMessage={currentMessage}
          setCurrentMessage={setCurrentMessage}
          isStreaming={isStreaming}
          onSendMessage={handleSendMessage}
          onStopStreaming={stop}
          shareToken={shareToken}
          chatbotId={chatbotId}
          voiceInputEnabled={voiceInputEnabled}
        />
      </div>
    </div>
  );
}
