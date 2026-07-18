import { eq, and } from "drizzle-orm";
import { db } from "@teachanything/db";
import { chatbots } from "@teachanything/db/schema";
import { logError } from "@/lib/logger";
import { checkRateLimit, publicStudyResponseRateLimit } from "@/lib/rate-limit";
import { getTrustedClientIp } from "@/lib/get-client-ip";
import {
  sharedStudyRequestSchema,
  recordStudyResponse,
  StudyRequestError,
} from "@/server/study/request";

/**
 * Persist a student's study-tool attempt from a public shared link. No auth;
 * bounded per (IP, shareToken). Rate limiting is best-effort (fail-open) here
 * unlike the shared chat/transcribe routes: this is a cheap DB write with no
 * paid LLM/Whisper cost, and rows cascade-delete with the conversation, so a
 * Redis outage isn't worth denying legitimate students over.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const parsed = sharedStudyRequestSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return new Response("Invalid request", { status: 400 });
    }
    const { shareToken } = parsed.data;

    const clientIp = getTrustedClientIp(req.headers);
    const { success } = await checkRateLimit(
      publicStudyResponseRateLimit,
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

    await recordStudyResponse({
      chatbotId: chatbot.id,
      sessionId: parsed.data.sessionId,
      toolCallId: parsed.data.toolCallId,
      toolName: parsed.data.toolName,
      answers: parsed.data.answers,
      db,
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof StudyRequestError) {
      return new Response(error.message, { status: error.status });
    }
    logError(error, "POST /api/study-response/shared failed");
    return new Response("Failed to save response", { status: 500 });
  }
}
