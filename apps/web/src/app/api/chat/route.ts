import { eq, and } from "drizzle-orm";
import { db } from "@teachanything/db";
import { chatbots } from "@teachanything/db/schema";
import { auth } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { checkRateLimit, authenticatedChatRateLimit } from "@/lib/rate-limit";
import { streamChat, newSessionId } from "@/server/chat/stream-chat";
import type { StudyUIMessage } from "@/server/chat/study-tools";

// Allow long streams (mirrors the prior 5-minute subscription cap).
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { success } = await checkRateLimit(
      authenticatedChatRateLimit,
      session.user.id,
    );
    if (!success) {
      return new Response("Too many messages. Please slow down.", {
        status: 429,
      });
    }

    const body = (await req.json()) as {
      message: StudyUIMessage;
      sessionId?: string;
      chatbotId: string;
    };

    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, body.chatbotId),
          eq(chatbots.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!chatbot) {
      return new Response("Chatbot not found", { status: 404 });
    }

    return await streamChat({
      chatbot,
      userMessage: body.message,
      sessionId: body.sessionId || newSessionId(),
      db,
      eventType: "message_sent",
    });
  } catch (error) {
    logError(error, "POST /api/chat failed");
    return new Response("Failed to send message", { status: 500 });
  }
}
