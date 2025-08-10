import { AIClient } from './client';
import { AIClientConfig } from './types';

/**
 * Factory function to create AI client instances
 * This is useful for creating clients on-demand for each chatbot session
 */
export function createAIClient(config: AIClientConfig): AIClient {
  return new AIClient(config);
}

/**
 * Create a client from a chatbot ID and session
 * This would fetch the chatbot configuration from the database
 */
export async function createAIClientFromChatbot(
  _chatbotId: string,
  _sessionId: string,
  _dbConnection: any // Your database connection
): Promise<AIClient> {
  // This is a placeholder - you would fetch from your database
  // const chatbot = await db.query.chatbots.findFirst({
  //   where: eq(chatbots.id, chatbotId),
  //   with: { files: true }
  // });
  
  // For now, return a mock implementation
  throw new Error('Implement database fetching logic');
}


