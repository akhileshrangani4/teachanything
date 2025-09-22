export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
}

export interface ChatResponse {
  message: ChatMessage;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface FileContext {
  id: string;
  fileName: string;
  content: string;
  fileType: string;
}

export interface ChatbotConfig {
  id: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  welcomeMessage?: string;
  suggestedQuestions?: string[];
}

export interface AIClientConfig {
  apiKey: string;
  chatbot: ChatbotConfig;
  files?: FileContext[];
  sessionId?: string;
  userId?: string;
  openRouterConfig?: {
    siteUrl?: string;
    siteName?: string;
  };
}

export interface ProviderInterface {
  sendMessage(
    messages: ChatMessage[],
    config: ChatbotConfig,
    files?: FileContext[],
  ): Promise<ChatResponse>;
}
