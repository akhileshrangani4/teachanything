export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface ChatResponse {
  message: ChatMessage;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

export interface FileContext {
  id: string;
  fileName: string;
  content: string;
  fileType: string;
  metadata?: Record<string, any>;
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
  provider: AIProvider;
  apiKey: string;
  chatbot: ChatbotConfig;
  files?: FileContext[];
  sessionId?: string;
  userId?: string;
  // Optional OpenRouter specific config
  openRouterConfig?: {
    siteUrl?: string;
    siteName?: string;
  };
}

export enum AIProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GEMINI = 'gemini',
  OPENROUTER = 'openrouter'  // Add OpenRouter
}

export interface ProviderInterface {
  sendMessage(
    messages: ChatMessage[],
    config: ChatbotConfig,
    files?: FileContext[]
  ): Promise<ChatResponse>;
  
  embedText(text: string): Promise<number[]>;
}

export interface StreamingOptions {
  onToken?: (token: string) => void;
  onComplete?: (response: ChatResponse) => void;
  onError?: (error: Error) => void;
}
