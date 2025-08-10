import { createOpenAI } from '@ai-sdk/openai';
import { generateText, embedMany } from 'ai';
import { 
  ProviderInterface, 
  ChatMessage, 
  ChatResponse, 
  ChatbotConfig,
  FileContext 
} from '../types';

export class OpenAIProvider implements ProviderInterface {
  private openai: ReturnType<typeof createOpenAI>;

  constructor(apiKey: string) {
    this.openai = createOpenAI({
      apiKey: apiKey
    });
  }

  async sendMessage(
    messages: ChatMessage[], 
    config: ChatbotConfig,
    files?: FileContext[]
  ): Promise<ChatResponse> {
    try {
      // Build messages with file context if needed
      const messagesWithContext = this.buildMessagesWithContext(messages, files);
      
      const model = this.openai(config.model);

      const result = await generateText({
        model,
        messages: messagesWithContext.map(m => ({
          role: m.role as any,
          content: m.content
        })),
        temperature: config.temperature / 100, // Convert from 0-100 to 0-1
        maxTokens: config.maxTokens,
      });

      return {
        message: {
          role: 'assistant',
          content: result.text,
          timestamp: new Date()
        },
        usage: result.usage ? {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens
        } : undefined,
        metadata: {
          model: config.model,
          finishReason: result.finishReason
        }
      };
    } catch (error) {
      console.error('OpenAI Provider Error:', error);
      throw error;
    }
  }

  async embedText(text: string): Promise<number[]> {
    try {
      const model = this.openai.embedding('text-embedding-3-small');

      const { embeddings } = await embedMany({
        model,
        values: [text]
      });

      return embeddings[0];
    } catch (error) {
      console.error('OpenAI Embedding Error:', error);
      throw error;
    }
  }

  private buildMessagesWithContext(
    messages: ChatMessage[], 
    files?: FileContext[]
  ): ChatMessage[] {
    if (!files || files.length === 0) {
      return messages;
    }

    // Find the last user message and add file context
    const messagesWithContext = [...messages];
    const lastUserMessageIndex = messagesWithContext
      .map((m, i) => ({ message: m, index: i }))
      .filter(item => item.message.role === 'user')
      .pop()?.index;

    if (lastUserMessageIndex !== undefined) {
      const fileContext = files.map(f => 
        `[File: ${f.fileName}]\n${f.content}`
      ).join('\n\n');

      messagesWithContext[lastUserMessageIndex] = {
        ...messagesWithContext[lastUserMessageIndex],
        content: `${messagesWithContext[lastUserMessageIndex].content}\n\nContext:\n${fileContext}`
      };
    }

    return messagesWithContext;
  }
}