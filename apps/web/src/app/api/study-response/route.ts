import { eq, and } from "drizzle-orm";
import { db } from "@teachanything/db";
import { chatbots } from "@teachanything/db/schema";
import { auth } from "@/lib/auth";
import type { User } from "@/types/better-auth";
import { logError, logWarn } from "@/lib/logger";
import { checkRateLimit, studyResponseRateLimit } from "@/lib/rate-limit";
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
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const user = session.user as User;
    if (user.role !== "admin" && user.status !== "approved") {
      return new Response("Your account is pending admin approval", {
        status: 403,
      });
    }

    const { success } = await checkRateLimit(
      studyResponseRateLimit,
      session.user.id,
    );
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

    const [chatbot] = await db
      .select({ id: chatbots.id })
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
    logError(error, "POST /api/study-response failed");
    logWarn("study-response persist failed");
    return new Response("Failed to save response", { status: 500 });
  }
}
