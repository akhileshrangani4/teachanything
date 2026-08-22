import { db } from "@teachanything/db";
import { logError } from "@/lib/logger";
import { checkRateLimit, studyResponseRateLimit } from "@/lib/rate-limit";
import { requireApprovedUser } from "@/server/api-auth";
import { findOwnedChatbotId } from "@/server/queries/chatbot";
import {
  authedStudyRequestSchema,
  recordStudyResponse,
  StudyRequestError,
} from "@/server/study/request";

/**
 * Persist a student's study-tool attempt (e.g. a completed quiz) for the
 * authenticated owner's own chat. Mirrors the auth + approval gate of
 * /api/chat: only an approved (or admin) logged-in user may write.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const authResult = await requireApprovedUser(req.headers, {
      surface: "study-response",
    });
    if (!authResult.ok) return authResult.response;
    const user = authResult.user;

    const { success } = await checkRateLimit(studyResponseRateLimit, user.id);
    if (!success) {
      return new Response("Too many requests. Please slow down.", {
        status: 429,
      });
    }

    const parsed = authedStudyRequestSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return new Response("Invalid request", { status: 400 });
    }

    const ownedChatbot = await findOwnedChatbotId(
      db,
      parsed.data.chatbotId,
      user.id,
    );
    if (!ownedChatbot) {
      return new Response("Chatbot not found", { status: 404 });
    }

    await recordStudyResponse({
      chatbotId: ownedChatbot.id,
      sessionId: parsed.data.sessionId,
      toolCallId: parsed.data.toolCallId,
      response: parsed.data.response,
      db,
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof StudyRequestError) {
      return new Response(error.message, { status: error.status });
    }
    logError(error, "POST /api/study-response failed");
    return new Response("Failed to save response", { status: 500 });
  }
}
