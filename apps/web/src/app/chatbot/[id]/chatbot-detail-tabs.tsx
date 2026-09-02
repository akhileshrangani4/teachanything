"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatInterface } from "@/components/chat/messages/ChatInterface";
import { ChatbotSettings } from "@/components/chat/settings/ChatbotSettings";
import { EmbedCode } from "@/components/chat/sharing/EmbedCode";
import { ChatbotFilesTab } from "@/components/chat/files/ChatbotFilesTab";
import type { RouterOutputs } from "@/lib/trpc";
import { WebSourcesTab } from "@/components/chatbot/WebSourcesTab";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ConversationsTab } from "@/components/chatbot/ConversationsTab";
import { ChatbotAnalyticsTab } from "@/components/chatbot/AnalyticsTab";
import type { StudyUIMessage } from "@/server/chat/study-tools";
import type { StudyResponsePayload } from "@/lib/submit-study-response";
import type { ChatStatus } from "ai";

type Chatbot = NonNullable<RouterOutputs["chatbot"]["get"]>;

interface ChatbotDetailTabsProps {
  activeTab: string;
  onTabChange: (value: string) => void;
  chatbotId: string;
  chatbot: Chatbot;
  filesLoading: boolean;
  onRefetchFiles: () => void;
  messages: StudyUIMessage[];
  status: ChatStatus;
  currentMessage: string;
  setCurrentMessage: (message: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  resetChat: () => void;
  stop?: () => void;
  showSources: boolean;
  onStudyAttempt: (toolCallId: string, response: StudyResponsePayload) => void;
  studyAttempts: Record<string, StudyResponsePayload[]>;
}

/** All tab content for the chatbot detail view. */
export function ChatbotDetailTabs({
  activeTab,
  onTabChange,
  chatbotId,
  chatbot,
  filesLoading,
  onRefetchFiles,
  messages,
  status,
  currentMessage,
  setCurrentMessage,
  handleSendMessage,
  messagesEndRef,
  resetChat,
  stop,
  showSources,
  onStudyAttempt,
  studyAttempts,
}: ChatbotDetailTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-6">
      <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted-foreground/10 border border-border">
        <TabsTrigger value="chat">Chat</TabsTrigger>
        <TabsTrigger value="files">Files</TabsTrigger>
        <TabsTrigger value="web-sources">Web Sources</TabsTrigger>
        <TabsTrigger value="conversations">Student Chats</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        {chatbot.sharingEnabled && chatbot.shareToken && (
          <TabsTrigger value="embed">Embed</TabsTrigger>
        )}
      </TabsList>

      {/* Chat Tab */}
      <TabsContent value="chat" className="mt-6">
        <ErrorBoundary>
          <ChatInterface
            messages={messages}
            status={status}
            currentMessage={currentMessage}
            setCurrentMessage={setCurrentMessage}
            handleSendMessage={handleSendMessage}
            messagesEndRef={messagesEndRef}
            chatbotName={chatbot.name || "Chatbot"}
            resetChat={resetChat}
            stop={stop}
            showSources={showSources}
            chatbotId={chatbot.id}
            voiceInputEnabled
            onStudyAttempt={onStudyAttempt}
            studyAttempts={studyAttempts}
          />
        </ErrorBoundary>
      </TabsContent>

      {/* Files Tab */}
      <TabsContent value="files" className="mt-6">
        <ChatbotFilesTab
          chatbotId={chatbotId}
          filesLoading={filesLoading}
          onRefetch={onRefetchFiles}
        />
      </TabsContent>

      {/* Web Sources Tab */}
      <TabsContent value="web-sources" className="mt-6">
        <WebSourcesTab chatbotId={chatbotId} />
      </TabsContent>

      <TabsContent value="conversations" className="mt-6">
        <ConversationsTab chatbotId={chatbotId} />
      </TabsContent>

      <TabsContent value="analytics" className="mt-6">
        <ChatbotAnalyticsTab chatbotId={chatbotId} />
      </TabsContent>

      {/* Settings Tab */}
      <TabsContent value="settings" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Chatbot Settings</CardTitle>
            <CardDescription>Configure your chatbot</CardDescription>
          </CardHeader>
          <CardContent>
            <ChatbotSettings
              chatbot={{
                name: chatbot.name,
                description: chatbot.description,
                model: chatbot.model,
                systemPrompt: chatbot.systemPrompt,
                temperature: chatbot.temperature,
                maxTokens: chatbot.maxTokens,
                shareToken: chatbot.shareToken,
                sharingEnabled: chatbot.sharingEnabled,
                showSources: chatbot.showSources ?? false,
              }}
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Embed Tab */}
      {chatbot.sharingEnabled && chatbot.shareToken && (
        <TabsContent value="embed" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Embed On Website</CardTitle>
              <CardDescription>
                Add your chatbot to any website. Choose between a floating
                widget button (recommended for most sites) or an always-visible
                chat window. Works with HTML, WordPress, React, Next.js, and any
                web platform.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmbedCode shareToken={chatbot.shareToken} />
            </CardContent>
          </Card>
        </TabsContent>
      )}
    </Tabs>
  );
}
