"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/auth-client";
import { useRouter, useParams } from "next/navigation";
import { useChatbot } from "@/hooks/useChatbot";
import { ChatInterface } from "@/components/chat/messages/ChatInterface";
import { ChatbotSettings } from "@/components/chat/settings/ChatbotSettings";
import { EmbedCode } from "@/components/chat/sharing/EmbedCode";
import { ShareLinkSection } from "@/components/chat/sharing/ShareLinkSection";
import { ChatbotFilesTab } from "@/components/chat/files/ChatbotFilesTab";
import { WrappableText } from "@/components/ui/wrappable-text";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useFilePolling } from "@/hooks/useFilePolling";

export default function ChatbotDetailPage() {
  const router = useRouter();
  const params = useParams();
  const chatbotId = params.id as string;
  const { data: session, isPending: sessionLoading } = useSession();

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
  } = useChatbot(chatbotId, session);

  // Fetch files associated with this chatbot (will be paginated in ChatbotFilesTab)
  const { isLoading: filesLoading, refetch: refetchFiles } =
    trpc.files.listForChatbot.useQuery(
      { chatbotId, limit: 1, offset: 0 },
      {
        enabled: !!session && !!chatbotId,
        refetchInterval: useFilePolling(),
      },
    );

  // Generate share token mutation
  const utils = trpc.useUtils();
  const generateShareToken = trpc.chatbot.generateShareToken.useMutation({
    onSuccess: async () => {
      await utils.chatbot.get.invalidate({ id: chatbotId });
      await utils.chatbot.getById.invalidate({ id: chatbotId });
    },
    onError: () => {
      // Error handling is done in ShareLinkSection component
    },
  });

  const handleEnableSharing = () => {
    generateShareToken.mutate({ id: chatbotId });
  };

  // Loading state
  if (sessionLoading || chatbotLoading) {
    return (
      <div className="flex-1 p-4 md:p-6 lg:p-8 min-w-0">
        <div className="max-w-7xl mx-auto space-y-8">
          <div>
            <Skeleton className="h-10 w-64 mb-3" />
            <Skeleton className="h-5 w-96" />
            <div className="flex items-center gap-2 mt-4">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-32 rounded-full" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-16 rounded-md" />
            <Skeleton className="h-9 w-16 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  // Redirect if not logged in
  if (!session) {
    router.push("/login");
    return null;
  }

  // Not found
  if (!chatbot) {
    return (
      <div className="flex-1 p-4 md:p-6 lg:p-8 min-w-0">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Chatbot Not Found</CardTitle>
              <CardDescription>
                The chatbot you&apos;re looking for doesn&apos;t exist.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push("/dashboard")}>
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 min-w-0">
      <div className="max-w-7xl mx-auto space-y-8 overflow-hidden">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              {chatbot.name}
            </h1>
          </div>
          <p className="text-muted-foreground mt-2 text-lg">
            <WrappableText>{chatbot.description}</WrappableText>
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Badge>{chatbot.model}</Badge>
            {chatbot.sharingEnabled && (
              <Badge variant="outline">Sharing Enabled</Badge>
            )}
          </div>

          {/* Share Link Section */}
          <div className="mt-6">
            <ShareLinkSection
              shareToken={chatbot.shareToken}
              sharingEnabled={chatbot.sharingEnabled}
              onEnableSharing={handleEnableSharing}
              isEnabling={generateShareToken.isPending}
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="chat" className="space-y-6">
          <TabsList className="bg-muted-foreground/10 border border-border">
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            {chatbot.sharingEnabled && chatbot.shareToken && (
              <TabsTrigger value="embed">Embed</TabsTrigger>
            )}
          </TabsList>

          {/* Chat Tab */}
          <TabsContent value="chat" className="mt-6">
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
              showSources={chatbot.showSources ?? false}
            />
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="mt-6">
            <ChatbotFilesTab
              chatbotId={chatbotId}
              filesLoading={filesLoading}
              onRefetch={refetchFiles}
            />
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
                    widget button (recommended for most sites) or an
                    always-visible chat window. Works with HTML, WordPress,
                    React, Next.js, and any web platform.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EmbedCode shareToken={chatbot.shareToken} />
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
