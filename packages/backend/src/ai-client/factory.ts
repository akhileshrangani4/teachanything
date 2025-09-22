import { AIClient } from "./client";
import { AIClientConfig } from "./types";

/**
 * Factory function to create AI client instances
 * This is useful for creating clients on-demand for each chatbot session
 */
export function createAIClient(config: AIClientConfig): AIClient {
  return new AIClient(config);
}
