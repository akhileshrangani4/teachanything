import {
  AIClientConfig,
  ChatMessage,
  ChatResponse,
  FileContext,
  ProviderInterface,
} from "./types";
import { OpenRouterProvider } from "./openrouter";

export class AIClient {
  private provider: ProviderInterface;
  private config: AIClientConfig;
  private messages: ChatMessage[] = [];
  private files: FileContext[] = [];
  private sessionId: string;

  constructor(config: AIClientConfig) {
    this.config = config;
    this.provider = new OpenRouterProvider(
      config.apiKey,
      config.openRouterConfig,
    );
    this.sessionId = config.sessionId || this.generateSessionId();
    this.files = config.files || [];

    // Initialize with system prompt
    if (config.chatbot.systemPrompt) {
      this.messages.push({
        role: "system",
        content: this.buildSystemPrompt(),
      });
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private buildSystemPrompt(): string {
    let systemPrompt = this.config.chatbot.systemPrompt;

    // Add file context to system prompt if files are provided
    if (this.files.length > 0) {
      systemPrompt += "\n\n### Context Files:\n";
      this.files.forEach((file) => {
        systemPrompt += `\n#### ${file.fileName} (${file.fileType}):\n`;
        systemPrompt += `${file.content.substring(0, 2000)}...\n`;
      });
    }

    return systemPrompt;
  }

  public async sendMessage(content: string): Promise<ChatResponse> {
    const userMessage: ChatMessage = {
      role: "user",
      content,
      timestamp: new Date(),
    };
    this.messages.push(userMessage);

    const response = await this.provider.sendMessage(
      this.messages,
      this.config.chatbot,
      this.files,
    );

    this.messages.push(response.message);
    return response;
  }

  public addFile(file: FileContext): void {
    this.files.push(file);
    // Rebuild system prompt with new file context
    if (this.messages.length > 0 && this.messages[0].role === "system") {
      this.messages[0].content = this.buildSystemPrompt();
    }
  }

  public removeFile(fileId: string): void {
    this.files = this.files.filter((f) => f.id !== fileId);
    // Rebuild system prompt without the file
    if (this.messages.length > 0 && this.messages[0].role === "system") {
      this.messages[0].content = this.buildSystemPrompt();
    }
  }

  public getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  public clearHistory(): void {
    this.messages = this.messages.filter((m) => m.role === "system");
  }

  public getSessionId(): string {
    return this.sessionId;
  }
}
