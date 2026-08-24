import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, embed, streamText, type LanguageModel } from "ai";
import { logInfo } from "@teachanything/logger";
import { EMBEDDING_MODEL, type SupportedModel } from "./models";
import { isTransientError } from "./error-utils";

// Re-export so consumers of @teachanything/ai/openrouter subpath still get these
export { SUPPORTED_MODELS, type SupportedModel } from "./models";
export { isTransientError } from "./error-utils";

// OpenRouter client configuration
export class OpenRouterClient {
  private client: ReturnType<typeof createOpenRouter>;
  private openaiClient: ReturnType<typeof createOpenAI> | null = null;

  constructor(apiKey: string, openaiApiKey?: string) {
    if (!apiKey) {
      throw new Error("OpenRouter API key is required");
    }

    // Use official OpenRouter provider which defaults to 'compatible' mode
    // This uses the chat completions API format instead of the responses API
    this.client = createOpenRouter({
      apiKey,
    });

    // OpenRouter doesn't support embeddings, so use OpenAI directly if key is provided
    if (openaiApiKey) {
      this.openaiClient = createOpenAI({
        apiKey: openaiApiKey,
      });
    }
  }

  /**
   * Return the provider model instance for direct use with the AI SDK's
   * `streamText` (e.g. when registering tools and returning a UI message
   * stream). Provider configuration stays centralized here.
   */
  getModel(model: SupportedModel): LanguageModel {
    return this.client(model);
  }

  /**
   * Generate text response using specified model
   */
  async generateText(params: {
    model: SupportedModel;
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{
    text: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    finishReason?: string;
  }> {
    const result = await generateText({
      model: this.client(params.model),
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      maxOutputTokens: params.maxTokens ?? 2000,
    });

    return {
      text: result.text,
      usage: result.usage
        ? {
            promptTokens: result.usage.inputTokens ?? 0,
            completionTokens: result.usage.outputTokens ?? 0,
            totalTokens: result.usage.totalTokens ?? 0,
          }
        : undefined,
      finishReason: result.finishReason,
    };
  }

  /**
   * Stream text response using specified model
   */
  async streamText(params: {
    model: SupportedModel;
    /**
     * System prompt. Passed via the dedicated `system` option (not as a
     * role:"system" message) to avoid the AI SDK prompt-injection warning and
     * keep system instructions out of the user/assistant turn stream.
     */
    system?: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    temperature?: number;
    maxTokens?: number;
    // Agentic additions (all optional; omitted => behaves exactly as before)
    tools?: Parameters<typeof streamText>[0]["tools"];
    stopWhen?: Parameters<typeof streamText>[0]["stopWhen"];
    prepareStep?: Parameters<typeof streamText>[0]["prepareStep"];
    onStepFinish?: Parameters<typeof streamText>[0]["onStepFinish"];
    experimental_repairToolCall?: Parameters<
      typeof streamText
    >[0]["experimental_repairToolCall"];
  }) {
    const result = await streamText({
      model: this.client(params.model),
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      maxOutputTokens: params.maxTokens ?? 2000,
      ...(params.system ? { system: params.system } : {}),
      ...(params.tools ? { tools: params.tools } : {}),
      ...(params.stopWhen ? { stopWhen: params.stopWhen } : {}),
      ...(params.prepareStep ? { prepareStep: params.prepareStep } : {}),
      ...(params.onStepFinish ? { onStepFinish: params.onStepFinish } : {}),
      ...(params.experimental_repairToolCall
        ? { experimental_repairToolCall: params.experimental_repairToolCall }
        : {}),
    });

    return result;
  }

  /**
   * Generate embedding for text using OpenAI's text-embedding-3-small
   * Note: OpenRouter doesn't support embeddings, so this uses OpenAI directly
   * Includes retry logic for rate limit errors
   */
  async generateEmbedding(text: string, retries = 3): Promise<number[]> {
    if (!this.openaiClient) {
      throw new Error(
        "OpenAI API key required for embeddings. OpenRouter does not support embeddings. " +
          "Please provide OPENAI_API_KEY environment variable.",
      );
    }

    const embeddingModel = this.openaiClient.embedding(EMBEDDING_MODEL.id);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const { embedding } = await embed({
          model: embeddingModel,
          value: text,
        });
        return embedding;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (isTransientError(lastError.message) && attempt < retries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000;
          logInfo(`Transient error, retrying in ${delay}ms`, {
            attempt: attempt + 1,
            retries,
            delayMs: delay,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // If not transient or last attempt, throw
        throw lastError;
      }
    }

    throw lastError || new Error("Failed to generate embedding");
  }

  /**
   * Generate embeddings for multiple texts with rate limiting
   * Process texts sequentially with small delays to avoid rate limits
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    // Process in smaller micro-batches with delays to respect rate limits
    const MICRO_BATCH_SIZE = 10; // Process 10 at a time
    const DELAY_MS = 100; // 100ms delay between micro-batches

    for (let i = 0; i < texts.length; i += MICRO_BATCH_SIZE) {
      const microBatch = texts.slice(
        i,
        Math.min(i + MICRO_BATCH_SIZE, texts.length),
      );

      // Process micro-batch in parallel
      const microBatchEmbeddings = await Promise.all(
        microBatch.map((text) => this.generateEmbedding(text)),
      );

      embeddings.push(...microBatchEmbeddings);

      // Add delay between micro-batches to avoid rate limits (except for last batch)
      if (i + MICRO_BATCH_SIZE < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }

    return embeddings;
  }
}

/**
 * Create OpenRouter client instance
 */
export function createOpenRouterClient(
  apiKey: string,
  openaiApiKey?: string,
): OpenRouterClient {
  return new OpenRouterClient(apiKey, openaiApiKey);
}
