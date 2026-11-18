import { eq, and } from "drizzle-orm";
import { db } from "@teachanything/db";
import { chatbots } from "@teachanything/db/schema";
import { logError } from "@/lib/logger";
import {
  checkRateLimit,
  publicMessageRatingRateLimit,
} from "@/server/rate-limit";
import { getTrustedClientIp } from "@/lib/get-client-ip";
import {
  recordMessageRating,
  sharedMessageRatingSchema,
} from "@/server/ratings/message-rating";

/**
 * Save a student's thumbs up/down on an assistant message from a public shared
 * link. No auth: the session id scopes it, and the message must belong to that
 * session. Re-rating replaces the earlier rating. Rate limiting is fail-open,
 * as for study responses: a cheap DB write with no LLM cost isn't worth denying
 * students over during a Redis outage.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const parsed = sharedMessageRatingSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return new Response("Invalid request", { status: 400 });
    }
    const { shareToken, sessionId, messageId, rating } = parsed.data;

    const clientIp = getTrustedClientIp(req.headers);
    const { success } = await checkRateLimit(
      publicMessageRatingRateLimit,
      `${shareToken}:${clientIp}`,
    );
    if (!success) {
      return new Response("Too many requests. Please slow down.", {
        status: 429,
      });
    }

    const [chatbot] = await db
      .select({ id: chatbots.id })
      .from(chatbots)
      .where(
        and(
          eq(chatbots.shareToken, shareToken),
          eq(chatbots.sharingEnabled, true),
        ),
      )
      .limit(1);
    if (!chatbot) {
      return new Response("Chatbot not found or sharing is disabled", {
        status: 404,
      });
    }

    const result = await recordMessageRating({
      chatbotId: chatbot.id,
      sessionId,
      messageId,
      rating,
      db,
    });
    if (result.status === "message_not_found") {
      return new Response("Message not found for this session", {
        status: 404,
      });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    logError(error, "POST /api/message-rating/shared failed");
    return new Response("Failed to save rating", { status: 500 });
  }
}
