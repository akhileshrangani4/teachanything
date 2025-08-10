import dotenv from 'dotenv';
dotenv.config();

// This file is now just for testing the AI client directly
// The main application runs from src/api/server.ts

import { createAIClient } from './ai-client';
import { AIProvider } from './ai-client/types';

async function testAIClient() {
  console.log('Testing AI Client...');
  
  const client = createAIClient({
    provider: AIProvider.OPENAI,
    apiKey: process.env.OPENAI_API_KEY!,
    chatbot: {
      id: 'test-chatbot',
      systemPrompt: 'You are a helpful assistant.',
      model: 'gpt-4o-mini',
      temperature: 70,
      maxTokens: 500
    }
  });

  const response = await client.sendMessage('Hello! Can you help me test this system?');
  console.log('Response:', response.message.content);
}

// Only run if this file is executed directly
if (require.main === module) {
  testAIClient().catch(console.error);
} 