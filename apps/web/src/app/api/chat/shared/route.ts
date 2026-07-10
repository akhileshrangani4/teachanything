import { eq, and } from "drizzle-orm";
import { db } from "@teachanything/db";
import { chatbots } from "@teachanything/db/schema";
import { logError } from "@/lib/logger";
import { checkRateLimit, publicChatRateLimit } from "@/lib/rate-limit";
import { getTrustedClientIp } from "@/lib/get-client-ip";
import { streamChat, newSessionId } from "@/server/chat/stream-chat";
import type { StudyUIMessage } from "@/server/chat/study-tools";

export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as {
      message: StudyUIMessage;
      sessionId?: string;
      shareToken: string;
    };

    // Rate limit by share token + trusted client IP. Uses the spoof-resistant
    // helper (never the leftmost x-forwarded-for).
    const clientIp = getTrustedClientIp(req.headers);
    const { success } = await checkRateLimit(
      publicChatRateLimit,
      `${body.shareToken}:${clientIp}`,
    );
    if (!success) {
      return new Response("Too many messages. Please slow down.", {
        status: 429,
      });
    }

    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.shareToken, body.shareToken),
          eq(chatbots.sharingEnabled, true),
        ),
      )
      .limit(1);
    if (!chatbot) {
      return new Response("Chatbot not found or sharing is disabled", {
        status: 404,
      });
    }

    return await streamChat({
      chatbot,
      userMessage: body.message,
      sessionId: body.sessionId || newSessionId(),
      db,
      eventType: "shared_message_sent",
    });
  } catch (error) {
    logError(error, "POST /api/chat/shared failed");
    return new Response("Failed to send message", { status: 500 });
  }
}
