"use client";

import { useState, useRef, useEffect } from "react";
import { chat, analytics } from "@/lib/api";
import { PaperAirplaneIcon, XMarkIcon } from "@heroicons/react/24/solid";
import ReactMarkdown from "react-markdown";
import { nanoid } from "nanoid";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: Array<{ fileName: string; excerpt: string }>;
}

interface ChatWidgetProps {
  chatbotId?: string;
  shareToken?: string;
  config?: any;
  embedded?: boolean;
}

export function ChatWidget({
  chatbotId,
  shareToken,
  config,
  embedded = false,
}: ChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => nanoid());
  const [isOpen, setIsOpen] = useState(embedded);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Add welcome message if configured
    if (config?.welcomeMessage) {
      setMessages([
        {
          role: "assistant",
          content: config.welcomeMessage,
          timestamp: new Date(),
        },
      ]);
    }

    // Track widget open event
    if (chatbotId) {
      analytics.trackEvent({
        chatbotId,
        eventType: "widget_opened",
        sessionId,
        eventData: { embedded },
      });
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = shareToken
        ? await chat.sendSharedMessage(
            shareToken,
            userMessage.content,
            sessionId,
          )
        : await chat.sendMessage(chatbotId!, userMessage.content, sessionId);

      const assistantMessage: Message = {
        role: "assistant",
        content: response.data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const widgetContent = (
    <div className={`flex flex-col h-full ${embedded ? "" : "max-h-[600px]"}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">
              {config?.name || "AI Assistant"}
            </h3>
            <p className="text-xs opacity-90">Powered by AI</p>
          </div>
          {!embedded && (
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((message, index) => (
          <div key={index}>
            <div
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-900 shadow"
                }`}
              >
                {message.role === "assistant" ? (
                  <>
                    <ReactMarkdown className="prose prose-sm max-w-none">
                      {message.content}
                    </ReactMarkdown>
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Sources:</p>
                        {message.sources.map((source, idx) => (
                          <div key={idx} className="text-xs text-gray-600">
                            📄 {source.fileName}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm">{message.content}</p>
                )}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-lg px-4 py-2 shadow">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length === 1 && config?.suggestedQuestions?.length > 0 && (
        <div className="px-4 py-2 bg-gray-50">
          <p className="text-xs text-gray-500 mb-2">Suggested questions:</p>
          <div className="flex flex-wrap gap-2">
            {config.suggestedQuestions.map(
              (question: string, index: number) => (
                <button
                  key={index}
                  onClick={() => setInput(question)}
                  className="text-xs px-3 py-1 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
                >
                  {question}
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 bg-white border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex space-x-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );

  if (embedded) {
    return <div className="h-full">{widgetContent}</div>;
  }

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z"
            />
          </svg>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-5 right-5 w-96 h-[600px] bg-white rounded-lg shadow-2xl overflow-hidden z-50">
          {widgetContent}
        </div>
      )}
    </>
  );
}
