import { eq, and } from "drizzle-orm";
import { db } from "@teachanything/db";
import { chatbots } from "@teachanything/db/schema";
import { logError } from "@/lib/logger";
import {
  checkRateLimit,
  requireRateLimit,
  publicChatRateLimit,
  publicChatGlobalRateLimit,
} from "@/server/rate-limit";
import { getTrustedClientIp } from "@/lib/get-client-ip";
import { env } from "@/lib/env";
import { streamChat, newSessionId } from "@/server/chat/stream-chat";
import {
  sharedChatRequestSchema,
  buildUserMessage,
  ChatRequestError,
  chatErrorResponse,
} from "@/server/chat/request";

export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  try {
    const parsed = sharedChatRequestSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return chatErrorResponse("invalid_request", 400);
    }
    const userMessage = buildUserMessage(parsed.data.message);
    if (!userMessage) {
      return chatErrorResponse("message_needs_text", 400);
    }
    const { shareToken } = parsed.data;

    // Rate limit by share token + trusted client IP (spoof-resistant helper,
    // never the leftmost x-forwarded-for), plus a global per-share-token cap so
    // a distributed caller can't run up unbounded model spend against one link.
    const clientIp = getTrustedClientIp(req.headers);
    const limitGlobal =
      env.NODE_ENV === "production" ? requireRateLimit : checkRateLimit;
    const [perIp, global] = await Promise.all([
      checkRateLimit(publicChatRateLimit, `${shareToken}:${clientIp}`),
      limitGlobal(publicChatGlobalRateLimit, shareToken),
    ]);
    if (!perIp.success || !global.success) {
      return chatErrorResponse("rate_limited", 429);
    }

    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.shareToken, shareToken),
          eq(chatbots.sharingEnabled, true),
        ),
      )
      .limit(1);
    if (!chatbot) {
      return chatErrorResponse("chatbot_not_shared", 404);
    }

    return await streamChat({
      chatbot,
      userMessage,
      sessionId: parsed.data.sessionId || newSessionId(),
      db,
      eventType: "shared_message_sent",
      signal: req.signal,
    });
  } catch (error) {
    if (error instanceof ChatRequestError) {
      return chatErrorResponse(error.code, error.status);
    }
    logError(error, "POST /api/chat/shared failed");
    return chatErrorResponse("send_failed", 500);
  }
}
