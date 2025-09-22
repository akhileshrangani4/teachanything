import { db, chatbots, conversations, messages, analytics } from "../../db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

export class AnalyticsService {
  async getChatbotAnalytics(
    chatbotId: string,
    userId: string,
    timeRange: string,
  ) {
    // Verify ownership
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.user_id, userId)))
      .limit(1);

    if (!chatbot) {
      throw new Error("Chatbot not found or unauthorized");
    }

    const startDate = this.getStartDate(timeRange);

    // Get total conversations
    const totalConversations = await db
      .select({
        count: sql<number>`count(distinct ${conversations.id})`,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.chatbot_id, chatbotId),
          gte(conversations.created_at, startDate),
        ),
      );

    // Get total messages
    const totalMessages = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversation_id, conversations.id))
      .where(
        and(
          eq(conversations.chatbot_id, chatbotId),
          gte(messages.created_at, startDate),
        ),
      );

    // Get unique sessions
    const uniqueSessions = await db
      .select({
        count: sql<number>`count(distinct ${conversations.session_id})`,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.chatbot_id, chatbotId),
          gte(conversations.created_at, startDate),
        ),
      );

    // Get average messages per conversation
    const avgMessages = await db
      .select({
        avg: sql<number>`avg(message_count)`,
      })
      .from(
        db
          .select({
            conversation_id: conversations.id,
            message_count: sql<number>`count(${messages.id})`,
          })
          .from(conversations)
          .leftJoin(messages, eq(messages.conversation_id, conversations.id))
          .where(
            and(
              eq(conversations.chatbot_id, chatbotId),
              gte(conversations.created_at, startDate),
            ),
          )
          .groupBy(conversations.id)
          .as("conv_messages"),
      );

    // Get response time stats (placeholder - would need actual implementation)
    const responseTime = {
      average: 1.2,
      median: 0.8,
      p95: 2.5,
    };

    return {
      chatbotId,
      timeRange,
      metrics: {
        totalConversations: totalConversations[0]?.count || 0,
        totalMessages: totalMessages[0]?.count || 0,
        uniqueSessions: uniqueSessions[0]?.count || 0,
        avgMessagesPerConversation: avgMessages[0]?.avg || 0,
        responseTime,
      },
    };
  }

  async getUserAnalytics(userId: string, timeRange: string) {
    const startDate = this.getStartDate(timeRange);

    // Get all user's chatbots
    const userChatbots = await db
      .select({ id: chatbots.id })
      .from(chatbots)
      .where(eq(chatbots.user_id, userId));

    const chatbotIds = userChatbots.map((c) => c.id);

    if (chatbotIds.length === 0) {
      return {
        totalChatbots: 0,
        totalConversations: 0,
        totalMessages: 0,
        totalSessions: 0,
      };
    }

    // Get aggregated stats
    const stats = await db
      .select({
        totalConversations: sql<number>`count(distinct ${conversations.id})`,
        totalSessions: sql<number>`count(distinct ${conversations.session_id})`,
      })
      .from(conversations)
      .where(
        and(
          sql`${conversations.chatbot_id} IN ${sql.raw(`(${chatbotIds.map(() => "?").join(", ")})`)}`,
          gte(conversations.created_at, startDate),
        ),
      );

    const messageStats = await db
      .select({
        totalMessages: sql<number>`count(*)`,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversation_id, conversations.id))
      .where(
        and(
          sql`${conversations.chatbot_id} IN ${sql.raw(`(${chatbotIds.map(() => "?").join(", ")})`)}`,
          gte(messages.created_at, startDate),
        ),
      );

    return {
      totalChatbots: chatbotIds.length,
      totalConversations: stats[0]?.totalConversations || 0,
      totalMessages: messageStats[0]?.totalMessages || 0,
      totalSessions: stats[0]?.totalSessions || 0,
      timeRange,
    };
  }

  async getConversationAnalytics(
    chatbotId: string,
    userId: string,
    options: { startDate?: Date; endDate?: Date; limit: number },
  ) {
    // Verify ownership
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.user_id, userId)))
      .limit(1);

    if (!chatbot) {
      throw new Error("Chatbot not found or unauthorized");
    }

    const conditions = [eq(conversations.chatbot_id, chatbotId)];

    if (options.startDate) {
      conditions.push(gte(conversations.created_at, options.startDate));
    }
    if (options.endDate) {
      conditions.push(lte(conversations.created_at, options.endDate));
    }

    const convs = await db
      .select({
        id: conversations.id,
        sessionId: conversations.session_id,
        createdAt: conversations.created_at,
        messageCount: sql<number>`(
        SELECT COUNT(*) FROM ${messages} 
        WHERE ${messages.conversation_id} = ${conversations.id}
      )`,
        lastMessage: sql<Date>`(
        SELECT MAX(${messages.created_at}) FROM ${messages} 
        WHERE ${messages.conversation_id} = ${conversations.id}
      )`,
        userAgent: conversations.user_agent,
        referrer: conversations.referrer,
      })
      .from(conversations)
      .where(and(...conditions))
      .orderBy(desc(conversations.created_at))
      .limit(options.limit);

    return convs;
  }

  async getMessageVolume(chatbotId: string, userId: string, interval: string) {
    // Verify ownership
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.user_id, userId)))
      .limit(1);

    if (!chatbot) {
      throw new Error("Chatbot not found or unauthorized");
    }

    let dateFormat: string;
    switch (interval) {
      case "hour":
        dateFormat = "%Y-%m-%d %H:00:00";
        break;
      case "day":
        dateFormat = "%Y-%m-%d";
        break;
      case "week":
        dateFormat = "%Y-%W";
        break;
      case "month":
        dateFormat = "%Y-%m";
        break;
      default:
        dateFormat = "%Y-%m-%d";
    }

    const volume = await db
      .select({
        period: sql<string>`DATE_FORMAT(${messages.created_at}, '${dateFormat}')`,
        messageCount: sql<number>`count(*)`,
        userMessages: sql<number>`sum(case when ${messages.role} = 'user' then 1 else 0 end)`,
        assistantMessages: sql<number>`sum(case when ${messages.role} = 'assistant' then 1 else 0 end)`,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversation_id, conversations.id))
      .where(eq(conversations.chatbot_id, chatbotId))
      .groupBy(sql`DATE_FORMAT(${messages.created_at}, '${dateFormat}')`)
      .orderBy(sql`DATE_FORMAT(${messages.created_at}, '${dateFormat}')`);

    return volume;
  }

  async getPopularTopics(chatbotId: string, userId: string) {
    // Verify ownership
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.user_id, userId)))
      .limit(1);

    if (!chatbot) {
      throw new Error("Chatbot not found or unauthorized");
    }

    // Get recent user messages
    const recentMessages = await db
      .select({
        content: messages.content,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversation_id, conversations.id))
      .where(
        and(eq(conversations.chatbot_id, chatbotId), eq(messages.role, "user")),
      )
      .orderBy(desc(messages.created_at))
      .limit(100);

    // Simple word frequency analysis
    // In production, you'd want more sophisticated NLP
    const wordFreq: Record<string, number> = {};
    const stopWords = new Set([
      "the",
      "is",
      "at",
      "which",
      "on",
      "a",
      "an",
      "as",
      "are",
      "was",
      "were",
      "been",
      "be",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "must",
      "shall",
      "can",
      "need",
      "what",
      "how",
      "when",
      "where",
      "who",
      "why",
    ]);

    recentMessages.forEach((msg) => {
      const words = msg.content.toLowerCase().split(/\s+/);
      words.forEach((word) => {
        const cleaned = word.replace(/[^a-z0-9]/g, "");
        if (cleaned.length > 3 && !stopWords.has(cleaned)) {
          wordFreq[cleaned] = (wordFreq[cleaned] || 0) + 1;
        }
      });
    });

    // Get top topics
    const topics = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

    return {
      topics,
      totalMessages: recentMessages.length,
    };
  }

  async trackEvent(
    chatbotId: string,
    eventType: string,
    eventData: any,
    sessionId?: string,
  ) {
    await db.insert(analytics).values({
      chatbot_id: chatbotId,
      event_type: eventType,
      event_data: eventData,
      session_id: sessionId,
    });
  }

  private getStartDate(timeRange: string): Date {
    const now = new Date();
    switch (timeRange) {
      case "7d":
        return new Date(now.setDate(now.getDate() - 7));
      case "30d":
        return new Date(now.setDate(now.getDate() - 30));
      case "90d":
        return new Date(now.setDate(now.getDate() - 90));
      case "all":
        return new Date("2020-01-01");
      default:
        return new Date(now.setDate(now.getDate() - 7));
    }
  }
}
