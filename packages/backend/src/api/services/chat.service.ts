import { db, chatbots, conversations, messages, chatbotFiles, analytics } from '../../db';
import { eq, and } from 'drizzle-orm';
import { createAIClient } from '../../ai-client';
import { AIProvider } from '../../ai-client/types';
import { RAGService } from './rag.service';
import { nanoid } from 'nanoid';

export class ChatService {
  private ragService: RAGService;

  constructor() {
    this.ragService = new RAGService();
  }

  async processMessage(
    chatbotId: string,
    message: string,
    sessionId: string | undefined,
    context: any
  ) {
    // Get chatbot configuration
    const chatbot = await this.getChatbotWithFiles(chatbotId);
    
    if (!chatbot) {
      throw new Error('Chatbot not found');
    }

    // Create or get session
    const actualSessionId = sessionId || nanoid();
    
    // Get or create conversation
    let conversation = await this.getOrCreateConversation(
      chatbotId,
      actualSessionId,
      context
    );

    // Save user message
    await db.insert(messages).values({
      conversation_id: conversation.id,
      role: 'user',
      content: message,
      metadata: context.metadata || {}
    });

    // Perform RAG search to find relevant content
    let ragContext = '';
    let relevantChunks = [];
    
    try {
      // Search for relevant chunks from uploaded files
      relevantChunks = await this.ragService.searchRelevantChunks(
        chatbotId,
        message,
        5 // Get top 5 most relevant chunks
      );

      if (relevantChunks.length > 0) {
        ragContext = this.ragService.buildContext(relevantChunks);
        console.log(`Found ${relevantChunks.length} relevant chunks for query`);
      }
    } catch (error) {
      console.error('RAG search error:', error);
      // Continue without RAG context if search fails
    }

    // Get conversation history
    const history = await db.select()
      .from(messages)
      .where(eq(messages.conversation_id, conversation.id))
      .orderBy(messages.created_at)
      .limit(10); // Keep last 10 messages for context

    // Build enhanced system prompt with RAG context
    const enhancedSystemPrompt = this.buildEnhancedSystemPrompt(
      chatbot.system_prompt,
      ragContext
    );

    // Create AI client
    const aiClient = createAIClient({
      provider: this.getProviderFromModel(chatbot.model),
      apiKey: process.env[this.getApiKeyEnvVar(chatbot.model)]!,
      chatbot: {
        id: chatbot.id,
        systemPrompt: enhancedSystemPrompt,
        model: chatbot.model,
        temperature: chatbot.temperature || 0.7,
        maxTokens: chatbot.max_tokens || 2000,
        welcomeMessage: chatbot.welcome_message || '',
        suggestedQuestions: chatbot.suggested_questions as string[]
      },
      files: [], // We're using RAG instead of passing files directly
      sessionId: actualSessionId
    });

    // Add history to AI client
    history.forEach(msg => {
      if (msg.role !== 'user' || msg.content !== message) { // Skip the current message
        aiClient.getMessages().push({
          role: msg.role as any,
          content: msg.content,
          timestamp: msg.created_at || undefined
        });
      }
    });

    // Get AI response
    const response = await aiClient.sendMessage(message);

    // Save assistant message with RAG metadata
    await db.insert(messages).values({
      conversation_id: conversation.id,
      role: 'assistant',
      content: response.message.content,
      metadata: {
        ...response.metadata,
        usage: response.usage,
        ragUsed: relevantChunks.length > 0,
        chunksUsed: relevantChunks.length,
        sources: relevantChunks.map(c => ({
          fileName: c.file_name,
          chunkIndex: c.chunk_index,
          similarity: c.similarity
        }))
      }
    });

    // Track analytics
    await db.insert(analytics).values({
      chatbot_id: chatbotId,
      event_type: 'message_sent',
      event_data: {
        sessionId: actualSessionId,
        messageLength: message.length,
        responseLength: response.message.content.length,
        usage: response.usage,
        ragUsed: relevantChunks.length > 0
      },
      session_id: actualSessionId
    });

    return {
      response: response.message.content,
      sessionId: actualSessionId,
      usage: response.usage,
      metadata: {
        ...response.metadata,
        sources: relevantChunks.length > 0 ? relevantChunks.map(c => ({
          fileName: c.file_name,
          excerpt: c.content.substring(0, 100) + '...'
        })) : []
      }
    };
  }

  async processSharedMessage(
    shareToken: string,
    message: string,
    sessionId: string | undefined,
    context: any
  ) {
    // Get chatbot by share token
    const [chatbot] = await db.select()
      .from(chatbots)
      .where(eq(chatbots.share_token, shareToken))
      .limit(1);

    if (!chatbot || !chatbot.share_token) {
      throw new Error('Chatbot not found or not shareable');
    }

    return this.processMessage(chatbot.id, message, sessionId, context);
  }

  async getConversationHistory(
    chatbotId: string,
    sessionId: string,
    userId?: string
  ) {
    // Verify access if userId provided
    if (userId) {
      const [chatbot] = await db.select()
        .from(chatbots)
        .where(and(
          eq(chatbots.id, chatbotId),
          eq(chatbots.user_id, userId)
        ))
        .limit(1);

      if (!chatbot) {
        throw new Error('Unauthorized');
      }
    }

    // Get conversation
    const [conversation] = await db.select()
      .from(conversations)
      .where(and(
        eq(conversations.chatbot_id, chatbotId),
        eq(conversations.session_id, sessionId)
      ))
      .limit(1);

    if (!conversation) {
      return { messages: [] };
    }

    // Get messages
    const messageHistory = await db.select()
      .from(messages)
      .where(eq(messages.conversation_id, conversation.id))
      .orderBy(messages.created_at);

    return {
      messages: messageHistory,
      sessionId,
      conversationId: conversation.id
    };
  }

  private async getChatbotWithFiles(chatbotId: string) {
    const [chatbot] = await db.select()
      .from(chatbots)
      .where(eq(chatbots.id, chatbotId))
      .limit(1);

    if (!chatbot) {
      return null;
    }

    const files = await db.select()
      .from(chatbotFiles)
      .where(eq(chatbotFiles.chatbot_id, chatbotId));

    return { ...chatbot, files };
  }

  private async getOrCreateConversation(
    chatbotId: string,
    sessionId: string,
    context: any
  ) {
    let [conversation] = await db.select()
      .from(conversations)
      .where(and(
        eq(conversations.chatbot_id, chatbotId),
        eq(conversations.session_id, sessionId)
      ))
      .limit(1);

    if (!conversation) {
      [conversation] = await db.insert(conversations).values({
        chatbot_id: chatbotId,
        session_id: sessionId,
        user_agent: context.userAgent,
        ip_address: context.ipAddress,
        referrer: context.referrer,
        metadata: context.metadata || {}
      }).returning();

      // Track analytics
      await db.insert(analytics).values({
        chatbot_id: chatbotId,
        event_type: 'session_start',
        event_data: {
          userAgent: context.userAgent,
          referrer: context.referrer
        },
        session_id: sessionId
      });
    }

    return conversation;
  }

  private getProviderFromModel(model: string): AIProvider {
    if (model.includes('/')) {
      return AIProvider.OPENROUTER;
    } else if (model.startsWith('claude')) {
      return AIProvider.ANTHROPIC;
    } else {
      return AIProvider.OPENAI;
    }
  }

  private getApiKeyEnvVar(model: string): string {
    if (model.includes('/')) {
      return 'OPENROUTER_API_KEY';
    } else if (model.startsWith('claude')) {
      return 'ANTHROPIC_API_KEY';
    } else {
      return 'OPENAI_API_KEY';
    }
  }

  private buildEnhancedSystemPrompt(basePrompt: string, ragContext: string): string {
    if (!ragContext) {
      return basePrompt;
    }

    return `${basePrompt}

${ragContext}

Please use the above context to answer questions. If the answer can be found in the context, use that information. If the context doesn't contain relevant information, you can use your general knowledge but mention that the information is not from the uploaded documents.`;
  }
}
