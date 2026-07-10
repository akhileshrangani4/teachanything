import { eq, and } from "drizzle-orm";
import { db } from "@teachanything/db";
import { chatbots } from "@teachanything/db/schema";
import { auth } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { checkRateLimit, authenticatedChatRateLimit } from "@/lib/rate-limit";
import { streamChat, newSessionId } from "@/server/chat/stream-chat";
import {
  authedChatRequestSchema,
  buildUserMessage,
} from "@/server/chat/request";

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

    const parsed = authedChatRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response("Invalid request", { status: 400 });
    }
    const userMessage = buildUserMessage(parsed.data.message);
    if (!userMessage) {
      return new Response("Message must contain text", { status: 400 });
    }

    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, parsed.data.chatbotId),
          eq(chatbots.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!chatbot) {
      return new Response("Chatbot not found", { status: 404 });
    }

    return await streamChat({
      chatbot,
      userMessage,
      sessionId: parsed.data.sessionId || newSessionId(),
      db,
      eventType: "message_sent",
      signal: req.signal,
    });
  } catch (error) {
    logError(error, "POST /api/chat failed");
    return new Response("Failed to send message", { status: 500 });
  }
}
