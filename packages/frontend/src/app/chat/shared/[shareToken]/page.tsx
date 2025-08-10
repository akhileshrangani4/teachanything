'use client';

import { useEffect, useState } from 'react';
import { chatbots } from '@/lib/api';
import { ChatWidget } from '@/components/ChatWidget';

export default function SharedChatPage({ params }: { params: { shareToken: string } }) {
  const [config, setConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadChatbot = async () => {
      try {
        // You'll need to add an endpoint to get chatbot by share token
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chatbots/shared/${params.shareToken}`);
        const data = await response.json();
        setConfig(data);
      } catch (error) {
        console.error('Failed to load chatbot:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadChatbot();
  }, [params.shareToken]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Chatbot Not Found</h2>
          <p className="mt-2 text-gray-600">This chatbot link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">{config.name}</h1>
          {config.description && (
            <p className="mt-3 text-lg text-gray-600">{config.description}</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-xl overflow-hidden" style={{ height: '600px' }}>
          <ChatWidget
            shareToken={params.shareToken}
            config={config}
            embedded={true}
          />
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          Powered by Chatbot Manager
        </div>
      </div>
    </div>
  );
}