import { db } from "@teachanything/db";
import { logError } from "@/lib/logger";
import {
  checkRateLimit,
  authenticatedChatRateLimit,
} from "@/server/rate-limit";
import { requireApprovedUser } from "@/server/api-auth";
import { findChatbotForUser } from "@/server/queries/chatbot";
import { streamChat, newSessionId } from "@/server/chat/stream-chat";
import {
  authedChatRequestSchema,
  buildUserMessage,
  ChatRequestError,
  chatErrorResponse,
} from "@/server/chat/request";

// Allow long streams (mirrors the prior 5-minute subscription cap).
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  try {
    const authResult = await requireApprovedUser(req.headers, {
      surface: "chat",
    });
    if (!authResult.ok) {
      return chatErrorResponse(authResult.code, authResult.response.status);
    }
    const user = authResult.user;

    const { success } = await checkRateLimit(
      authenticatedChatRateLimit,
      user.id,
    );
    if (!success) {
      return chatErrorResponse("rate_limited", 429);
    }

    const parsed = authedChatRequestSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return chatErrorResponse("invalid_request", 400);
    }
    const userMessage = buildUserMessage(parsed.data.message);
    if (!userMessage) {
      return chatErrorResponse("message_needs_text", 400);
    }

    const chatbot = await findChatbotForUser(
      db,
      parsed.data.chatbotId,
      user.id,
    );
    if (!chatbot) {
      return chatErrorResponse("chatbot_not_found", 404);
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
      return chatErrorResponse(error.code, error.status);
    }
    logError(error, "POST /api/chat failed");
    return chatErrorResponse("send_failed", 500);
  }
}
