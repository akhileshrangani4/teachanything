'use client';

import { useEffect, useState } from 'react';
import { chatbots } from '@/lib/api';
import { ChatWidget } from '@/components/ChatWidget';

export default function EmbedChatPage({ params }: { params: { chatbotId: string } }) {
  const [config, setConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadChatbot = async () => {
      try {
        const response = await chatbots.get(params.chatbotId);
        setConfig(response.data);
      } catch (error) {
        console.error('Failed to load chatbot:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadChatbot();
  }, [params.chatbotId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Chatbot not found</p>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <ChatWidget
        chatbotId={params.chatbotId}
        config={config}
        embedded={true}
      />
    </div>
  );
}