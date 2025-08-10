import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { 
  ProviderInterface, 
  ChatMessage, 
  ChatResponse, 
  ChatbotConfig,
  FileContext 
} from '../types';

export class AnthropicProvider implements ProviderInterface {
  private anthropic: ReturnType<typeof createAnthropic>;

  constructor(apiKey: string) {
    this.anthropic = createAnthropic({
      apiKey: apiKey
    });
  }

  async sendMessage(
    messages: ChatMessage[], 
    config: ChatbotConfig,
    files?: FileContext[]
  ): Promise<ChatResponse> {
    try {
      const messagesWithContext = this.buildMessagesWithContext(messages, files);
      
      const model = this.anthropic(this.mapModelName(config.model));

      const result = await generateText({
        model,
        messages: messagesWithContext.map(m => ({
          role: m.role as any,
          content: m.content
        })),
        temperature: config.temperature / 100,
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
      console.error('Anthropic Provider Error:', error);
      throw error;
    }
  }

  async embedText(_text: string): Promise<number[]> {
    // Anthropic doesn't have embeddings API, so we'll throw an error
    // In production, you might want to use a different embedding service
    throw new Error('Embedding not supported by Anthropic. Use OpenAI or another provider for embeddings.');
  }

  private mapModelName(model: string): string {
    // Map common model names to Anthropic model names
    const modelMap: Record<string, string> = {
      'claude-3-opus': 'claude-3-opus-20240229',
      'claude-3-sonnet': 'claude-3-sonnet-20240229',
      'claude-3-haiku': 'claude-3-haiku-20240307',
      'claude-2.1': 'claude-2.1',
      'claude-2': 'claude-2.0'
    };

    return modelMap[model] || model;
  }

  private buildMessagesWithContext(
    messages: ChatMessage[], 
    files?: FileContext[]
  ): ChatMessage[] {
    if (!files || files.length === 0) {
      return messages;
    }

    const messagesWithContext = [...messages];
    const lastUserMessageIndex = messagesWithContext
      .map((m, i) => ({ message: m, index: i }))
      .filter(item => item.message.role === 'user')
      .pop()?.index;

    if (lastUserMessageIndex !== undefined) {
      const fileContext = files.map(f => 
        `<document name="${f.fileName}" type="${f.fileType}">\n${f.content}\n</document>`
      ).join('\n\n');

      messagesWithContext[lastUserMessageIndex] = {
        ...messagesWithContext[lastUserMessageIndex],
        content: `${messagesWithContext[lastUserMessageIndex].content}\n\n${fileContext}`
      };
    }

    return messagesWithContext;
  }
}
