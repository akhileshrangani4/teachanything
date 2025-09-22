import { db, chatbots, chatbotFiles } from "../../db";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export class ChatbotService {
  async getUserChatbots(userId: string) {
    return await db
      .select()
      .from(chatbots)
      .where(eq(chatbots.user_id, userId))
      .orderBy(chatbots.created_at);
  }

  async getChatbot(chatbotId: string, userId?: string) {
    const conditions = userId
      ? and(eq(chatbots.id, chatbotId), eq(chatbots.user_id, userId))
      : eq(chatbots.id, chatbotId);

    const chatbot = await db.select().from(chatbots).where(conditions).limit(1);

    if (!chatbot[0]) {
      throw new Error("Chatbot not found");
    }

    // Get associated files
    const files = await db
      .select()
      .from(chatbotFiles)
      .where(eq(chatbotFiles.chatbot_id, chatbotId));

    return { ...chatbot[0], files };
  }

  async getChatbotByShareToken(shareToken: string) {
    const chatbot = await db
      .select()
      .from(chatbots)
      .where(eq(chatbots.share_token, shareToken))
      .limit(1);

    if (!chatbot[0]) {
      throw new Error("Chatbot not found");
    }

    return chatbot[0];
  }

  async createChatbot(data: any) {
    const [chatbot] = await db
      .insert(chatbots)
      .values({
        ...data,
        share_token: nanoid(10),
      })
      .returning();

    return chatbot;
  }

  async updateChatbot(chatbotId: string, userId: string, data: any) {
    const [updated] = await db
      .update(chatbots)
      .set({
        ...data,
        updated_at: new Date(),
      })
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.user_id, userId)))
      .returning();

    if (!updated) {
      throw new Error("Chatbot not found or unauthorized");
    }

    return updated;
  }

  async deleteChatbot(chatbotId: string, userId: string) {
    const deleted = await db
      .delete(chatbots)
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.user_id, userId)))
      .returning();

    if (!deleted[0]) {
      throw new Error("Chatbot not found or unauthorized");
    }

    return deleted[0];
  }

  async generateShareLink(chatbotId: string, userId: string) {
    const shareToken = nanoid(10);

    await db
      .update(chatbots)
      .set({
        share_token: shareToken,
        updated_at: new Date(),
      })
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.user_id, userId)));

    return shareToken;
  }
}
