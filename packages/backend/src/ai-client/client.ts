import { 
  AIClientConfig, 
  ChatMessage, 
  ChatResponse, 
  FileContext,
  ProviderInterface,
  StreamingOptions 
} from './types';
import { ProviderFactory } from './providers/factory';

export class AIClient {
  private provider: ProviderInterface;
  private config: AIClientConfig;
  private messages: ChatMessage[] = [];
  private files: FileContext[] = [];
  private sessionId: string;

  constructor(config: AIClientConfig) {
    this.config = config;
    this.provider = ProviderFactory.create(
      config.provider, 
      config.apiKey,
      config.openRouterConfig
    );
    this.sessionId = config.sessionId || this.generateSessionId();
    this.files = config.files || [];
    
    // Initialize with system prompt
    if (config.chatbot.systemPrompt) {
      this.messages.push({
        role: 'system',
        content: this.buildSystemPrompt()
      });
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private buildSystemPrompt(): string {
    let systemPrompt = this.config.chatbot.systemPrompt;
    
    // Add file context to system prompt if files are provided
    if (this.files.length > 0) {
      systemPrompt += '\n\n### Context Files:\n';
      this.files.forEach(file => {
        systemPrompt += `\n#### ${file.fileName} (${file.fileType}):\n`;
        systemPrompt += `${file.content.substring(0, 2000)}...\n`; // Truncate for system prompt
      });
    }
    
    return systemPrompt;
  }

  public async sendMessage(content: string): Promise<ChatResponse> {
    // Add user message to history
    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date()
    };
    this.messages.push(userMessage);

    try {
      // Send to provider
      const response = await this.provider.sendMessage(
        this.messages,
        this.config.chatbot,
        this.files
      );

      // Add assistant response to history
      this.messages.push(response.message);

      return response;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  public async sendMessageStream(
    content: string, 
    options: StreamingOptions
  ): Promise<void> {
    // Implementation for streaming responses
    // This will be provider-specific
    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date()
    };
    this.messages.push(userMessage);

    // Note: Streaming implementation would go here
    // For now, we'll use the regular sendMessage
    try {
      const response = await this.sendMessage(content);
      options.onComplete?.(response);
    } catch (error) {
      options.onError?.(error as Error);
    }
  }

  public addFile(file: FileContext): void {
    this.files.push(file);
    // Rebuild system prompt with new file context
    if (this.messages.length > 0 && this.messages[0].role === 'system') {
      this.messages[0].content = this.buildSystemPrompt();
    }
  }

  public removeFile(fileId: string): void {
    this.files = this.files.filter(f => f.id !== fileId);
    // Rebuild system prompt without the file
    if (this.messages.length > 0 && this.messages[0].role === 'system') {
      this.messages[0].content = this.buildSystemPrompt();
    }
  }

  public getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  public clearHistory(): void {
    // Keep only system message
    this.messages = this.messages.filter(m => m.role === 'system');
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public async embedText(text: string): Promise<number[]> {
    return this.provider.embedText(text);
  }

  public updateConfig(config: Partial<AIClientConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.provider || config.apiKey || config.openRouterConfig) {
      this.provider = ProviderFactory.create(
        config.provider || this.config.provider,
        config.apiKey || this.config.apiKey,
        config.openRouterConfig || this.config.openRouterConfig
      );
    }
  }
}