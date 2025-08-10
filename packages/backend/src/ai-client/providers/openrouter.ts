import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { 
  ProviderInterface, 
  ChatMessage, 
  ChatResponse, 
  ChatbotConfig,
  FileContext 
} from '../types';

export class OpenRouterProvider implements ProviderInterface {
  private openrouter: ReturnType<typeof createOpenAI>;

  constructor(apiKey: string, siteUrl?: string, siteName?: string) {
    this.openrouter = createOpenAI({
      apiKey: apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'HTTP-Referer': siteUrl || 'http://localhost:3000', // Your site URL for rankings
        'X-Title': siteName || 'Chatbot Manager', // Your site name for rankings
      }
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
      
      // Map model names to OpenRouter format
      const modelName = this.mapModelName(config.model);
      const model = this.openrouter(modelName);

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
          model: modelName,
          finishReason: result.finishReason,
          provider: 'openrouter'
        }
      };
    } catch (error) {
      console.error('OpenRouter Provider Error:', error);
      throw error;
    }
  }

  async embedText(text: string): Promise<number[]> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY!}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/text-embedding-ada-002',
          input: text
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const data = await response.json() as { data?: number[] };
      return data.data || [];
    } catch (error) {
      console.error('OpenRouter embedText error:', error);
      throw error;
    }
  }

  private mapModelName(model: string): string {
    // If model already includes provider prefix, return as is
    if (model.includes('/')) {
      return model;
    }

    // Map common model names to OpenRouter format
    const modelMap: Record<string, string> = {
      // OpenAI models
      'gpt-4o': 'openai/gpt-4o',
      'gpt-4o-mini': 'openai/gpt-4o-mini',
      'gpt-4-turbo': 'openai/gpt-4-turbo',
      'gpt-4': 'openai/gpt-4',
      'gpt-3.5-turbo': 'openai/gpt-3.5-turbo',
      
      // Anthropic models
      'claude-3-opus': 'anthropic/claude-3-opus',
      'claude-3-sonnet': 'anthropic/claude-3-sonnet',
      'claude-3-haiku': 'anthropic/claude-3-haiku',
      'claude-2.1': 'anthropic/claude-2.1',
      'claude-2': 'anthropic/claude-2',
      
      // Google models
      'gemini-pro': 'google/gemini-pro',
      'gemini-pro-vision': 'google/gemini-pro-vision',
      'gemini-1.5-pro': 'google/gemini-1.5-pro',
      'gemini-1.5-flash': 'google/gemini-1.5-flash',
      
      // Meta models
      'llama-3.1-405b': 'meta-llama/llama-3.1-405b-instruct',
      'llama-3.1-70b': 'meta-llama/llama-3.1-70b-instruct',
      'llama-3.1-8b': 'meta-llama/llama-3.1-8b-instruct',
      'llama-3-70b': 'meta-llama/llama-3-70b-instruct',
      'llama-3-8b': 'meta-llama/llama-3-8b-instruct',
      
      // Mistral models
      'mistral-large': 'mistralai/mistral-large',
      'mixtral-8x7b': 'mistralai/mixtral-8x7b-instruct',
      'mistral-7b': 'mistralai/mistral-7b-instruct',
      
      // Other popular models
      'deepseek-coder': 'deepseek/deepseek-coder-33b-instruct',
      'qwen-72b': 'qwen/qwen-72b-chat',
      'yi-34b': '01-ai/yi-34b-chat',
      'solar-10.7b': 'upstage/solar-10.7b-instruct'
    };

    return modelMap[model] || `openai/${model}`;
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

  // Get available models from OpenRouter
  static async getAvailableModels(apiKey: string): Promise<any[]> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      const data = await response.json() as { data?: number[] };
      return data.data || [];
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      throw error;
    }
  }
}
