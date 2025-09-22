import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import {
  ProviderInterface,
  ChatMessage,
  ChatResponse,
  ChatbotConfig,
  FileContext,
} from "./types";

interface OpenRouterConfig {
  siteUrl?: string;
  siteName?: string;
}

export class OpenRouterProvider implements ProviderInterface {
  private readonly openrouter: ReturnType<typeof createOpenAI>;

  constructor(apiKey: string, config?: OpenRouterConfig) {
    this.openrouter = createOpenAI({
      apiKey,
      baseURL: process.env.OPENROUTER_BASE_URL,
      headers: {
        "HTTP-Referer": config?.siteUrl || "http://localhost:3000",
        "X-Title": config?.siteName || "AI Chatbot",
      },
    });
  }

  async sendMessage(
    messages: ChatMessage[],
    config: ChatbotConfig,
    files?: FileContext[],
  ): Promise<ChatResponse> {
    const messagesWithContext = this.buildMessagesWithContext(messages, files);
    const model = this.openrouter(config.model);

    const result = await generateText({
      model,
      messages: messagesWithContext.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    return {
      message: {
        role: "assistant",
        content: result.text,
        timestamp: new Date(),
      },
      usage: result.usage
        ? {
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens,
          }
        : undefined,
    };
  }

  private buildMessagesWithContext(
    messages: ChatMessage[],
    files?: FileContext[],
  ): ChatMessage[] {
    if (!files || files.length === 0) {
      return messages;
    }

    const messagesWithContext = [...messages];
    const lastUserMessageIndex = messagesWithContext
      .map((m, i) => ({ message: m, index: i }))
      .filter((item) => item.message.role === "user")
      .pop()?.index;

    if (lastUserMessageIndex !== undefined) {
      const fileContext = files
        .map((f) => `[File: ${f.fileName}]\n${f.content}`)
        .join("\n\n");

      messagesWithContext[lastUserMessageIndex] = {
        ...messagesWithContext[lastUserMessageIndex],
        content: `${messagesWithContext[lastUserMessageIndex].content}\n\nContext:\n${fileContext}`,
      };
    }

    return messagesWithContext;
  }
}
