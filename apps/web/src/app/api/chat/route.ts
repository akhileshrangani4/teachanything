import { db } from "@teachanything/db";
import { logError } from "@/lib/logger";
import { checkRateLimit, authenticatedChatRateLimit } from "@/lib/rate-limit";
import { requireApprovedUser } from "@/server/api-auth";
import { findChatbotForUser } from "@/server/queries/chatbot";
import { streamChat, newSessionId } from "@/server/chat/stream-chat";
import {
  authedChatRequestSchema,
  buildUserMessage,
  ChatRequestError,
} from "@/server/chat/request";

// Allow long streams (mirrors the prior 5-minute subscription cap).
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  try {
    const authResult = await requireApprovedUser(req.headers, {
      surface: "chat",
    });
    if (!authResult.ok) return authResult.response;
    const user = authResult.user;

    const { success } = await checkRateLimit(
      authenticatedChatRateLimit,
      user.id,
    );
    if (!success) {
      return new Response("Too many messages. Please slow down.", {
        status: 429,
      });
    }

    const parsed = authedChatRequestSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return new Response("Invalid request", { status: 400 });
    }
    const userMessage = buildUserMessage(parsed.data.message);
    if (!userMessage) {
      return new Response("Message must contain text", { status: 400 });
    }

    const chatbot = await findChatbotForUser(
      db,
      parsed.data.chatbotId,
      user.id,
    );
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
    if (error instanceof ChatRequestError) {
      return new Response(error.message, { status: error.status });
    }
    logError(error, "POST /api/chat failed");
    return new Response("Failed to send message", { status: 500 });
  }
}
