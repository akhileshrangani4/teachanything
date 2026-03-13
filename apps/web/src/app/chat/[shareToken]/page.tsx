"use client";

import { useParams } from "next/navigation";
import { useChat } from "@/hooks/useChat";
import { ChatInterface } from "@/components/chat/messages/ChatInterface";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SharedChatSkeleton } from "@/components/ui/skeletons";

export default function SharedChatPage() {
  const params = useParams();
  const shareToken = params.shareToken as string;

  const {
    messages,
    currentMessage,
    setCurrentMessage,
    isStreaming,
    streamingContent,
    messagesEndRef,
    chatbot,
    chatbotLoading,
    handleSendMessage,
    resetChat,
    stopStreaming,
    error,
  } = useChat(shareToken);

  // Error state - show immediately if there's an error
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-2xl">Chatbot Not Available</CardTitle>
            <CardDescription>
              This chatbot link is no longer active or does not exist.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>This could happen if:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>The chatbot owner has disabled sharing</li>
                <li>The share link has expired or been regenerated</li>
                <li>The chatbot has been deleted</li>
                <li>The link is invalid</li>
              </ul>
              <p className="mt-4">
                Please contact the chatbot owner for a new share link.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (chatbotLoading) {
    return <SharedChatSkeleton />;
  }

  if (!chatbot) {
    return null;
  }

  return (
    <div className="h-dvh w-full overflow-hidden bg-secondary flex justify-center">
      <div className="h-full w-full max-w-6xl flex flex-col bg-background md:my-6 md:rounded-xl md:h-[calc(100dvh-48px)] md:border md:shadow-md">
        <ChatInterface
          messages={messages}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
          currentMessage={currentMessage}
          setCurrentMessage={setCurrentMessage}
          handleSendMessage={handleSendMessage}
          messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
          chatbotName={chatbot.name || "Chatbot"}
          resetChat={resetChat}
          stopStreaming={stopStreaming}
          height="flex-1 min-h-0"
          showFrame={false}
          showSources={chatbot.showSources ?? false}
          brandingText="Powered by Teach anything"
        />
      </div>
    </div>
  );
}
