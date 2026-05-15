import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@teachanything/db";
import { chatbots, analytics } from "@teachanything/db/schema";
import { eq, and } from "drizzle-orm";
import { findOwnedChatbotId } from "@/server/routers/chatbot";
import type { Ratelimit } from "@upstash/ratelimit";
import {
  transcriptionRateLimit,
  publicTranscriptionRateLimit,
  checkRateLimit,
} from "@/lib/rate-limit";
import {
  TRANSCRIPTION_LIMITS,
  validateAudioBlob,
} from "@/lib/transcription-validation";
import { env } from "@/lib/env";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { transcribeAudio, TranscriptionError } from "@teachanything/ai";
import {
  checkContentLength,
  jsonError,
  mapProviderError,
  type TranscribeErrorBody,
} from "./helpers";

export const runtime = "nodejs";
// Provider call can take ~60s for a 3-minute clip; cap the function
// generously so it doesn't time out before the helper does.
export const maxDuration = 120;

interface SuccessResponse {
  text: string;
  language: string | null;
  durationSeconds: number | null;
}

type ErrorResponse = TranscribeErrorBody;

interface AuthContext {
  identifier: string;
  limiter: Ratelimit | null;
  logContext: Record<string, unknown>;
  /**
   * Chatbot the request is attributed to, when known. Set automatically
   * on the shareToken path; on the authenticated path it must be
   * supplied by the client in the form body (and re-validated).
   */
  inferredChatbotId: string | null;
  /** Authenticated user id, when this is a session-based request. */
  userId: string | null;
}

/**
 * Resolve the rate-limit bucket. Authenticated session wins over
 * shareToken so a logged-in professor browsing their own share link
 * always hits their per-user bucket. Skips the session lookup when no
 * auth cookie is present to avoid a useless DB round-trip on anonymous
 * shared-link traffic.
 */
async function resolveAuth(
  request: NextRequest,
): Promise<AuthContext | { error: NextResponse<ErrorResponse> }> {
  const hasCookies = !!request.headers.get("cookie");

  if (hasCookies) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session?.user) {
      return {
        identifier: session.user.id,
        limiter: transcriptionRateLimit,
        logContext: { surface: "authenticated", userId: session.user.id },
        inferredChatbotId: null,
        userId: session.user.id,
      };
    }
  }

  const shareToken = new URL(request.url).searchParams.get("shareToken");
  if (!shareToken) {
    return { error: jsonError("Unauthorized", "unauthorized", 401) };
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
    return {
      error: jsonError(
        "Chatbot not found or sharing is disabled",
        "share_not_found",
        404,
      ),
    };
  }

  // Matches the IP-resolution pattern used by the public chat router
  // (server/routers/chat.ts). When `x-forwarded-for` is absent (e.g. a
  // direct connection, or a proxy that doesn't set it) all callers
  // collapse into the same "unknown" bucket — strict but consistent
  // with chat. A repo-wide IP-resolution helper (with `x-real-ip` etc.
  // fallback) would be the right long-term fix.
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return {
    identifier: `${shareToken}:${clientIp}`,
    limiter: publicTranscriptionRateLimit,
    logContext: { surface: "shared", shareToken, chatbotId: chatbot.id },
    inferredChatbotId: chatbot.id,
    userId: null,
  };
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  if (env.NEXT_PUBLIC_VOICE_INPUT_ENABLED === "false") {
    return jsonError("Voice input is disabled", "feature_disabled", 404);
  }

  const lengthError = checkContentLength(request);
  if (lengthError) return lengthError;

  const authResult = await resolveAuth(request);
  if ("error" in authResult) return authResult.error;
  const { identifier, limiter, logContext, inferredChatbotId, userId } =
    authResult;

  const { success, reset } = await checkRateLimit(limiter, identifier, {
    route: "transcribe",
  });
  if (!success) {
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return jsonError(
      `Too many transcription requests. Please try again in ${retryAfter} seconds.`,
      "rate_limited",
      429,
      { "Retry-After": retryAfter.toString() },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    logError(err, "Failed to parse transcribe formData", logContext);
    return jsonError("Invalid request body", "invalid_request", 400);
  }

  const audio = formData.get("audio");
  if (!(audio instanceof Blob)) {
    return jsonError("No audio file provided", "audio_invalid", 400);
  }

  const validation = validateAudioBlob(audio);
  if (!validation.ok) {
    return jsonError(validation.message, "audio_invalid", 400);
  }

  // Resolve the chatbot this transcription is attributed to for
  // analytics. Shared path: trust the chatbot resolved from the
  // shareToken. Authenticated path: trust the client-supplied id only
  // after verifying it belongs to this user.
  let effectiveChatbotId: string | null = inferredChatbotId;
  if (!effectiveChatbotId && userId) {
    const claimed = formData.get("chatbotId");
    if (typeof claimed === "string" && claimed.length > 0) {
      const owned = await findOwnedChatbotId(db, claimed, userId);
      if (owned) effectiveChatbotId = owned.id;
    }
  }

  try {
    const result = await transcribeAudio({
      apiKey: env.OPENAI_API_KEY,
      audio,
      filename: `recording.${validation.extension}`,
    });

    // Whisper reports the real audio duration in verbose_json. We can't
    // pre-check duration (would require decoding the audio server-side),
    // so we reject *after* the call when the cap is exceeded. The cost
    // is sunk for this one request, but the abuser doesn't get the
    // transcript and still consumes a rate-limit slot — so repeat abuse
    // is bounded.
    if (
      result.durationSeconds !== null &&
      result.durationSeconds >
        TRANSCRIPTION_LIMITS.MAX_DURATION_SECONDS_WITH_GRACE
    ) {
      logError(
        new Error("Transcription duration exceeded cap"),
        "Transcription duration exceeded cap",
        {
          ...logContext,
          durationSeconds: result.durationSeconds,
          audioBytes: validation.size,
        },
      );
      return jsonError(
        `Recording exceeds ${TRANSCRIPTION_LIMITS.MAX_DURATION_SECONDS} second limit`,
        "audio_duration_exceeded",
        400,
      );
    }

    // Log size + duration only; never the transcript or raw audio.
    // `languageDetected` is a boolean rather than the actual ISO code to
    // avoid logging a signal that could narrow user identity (spoken
    // language often correlates with national origin).
    logInfo("Transcription completed", {
      ...logContext,
      audioBytes: validation.size,
      mime: validation.mimeType,
      durationSeconds: result.durationSeconds,
      languageDetected: result.language !== null,
    });

    // Best-effort analytics insert. Schema requires chatbotId, so the
    // authenticated path silently skips when the client didn't supply
    // (or supplied an unauthorized) chatbot id. We don't fail the
    // request on insert errors — telemetry is not load-bearing.
    //
    // The eventData column's `$type` annotation enumerates chat-message
    // fields; voice fields aren't in that union yet. Cast here rather
    // than widening the shared schema type for a single event variant —
    // when we have a second non-chat event we should generalise the
    // schema type.
    if (effectiveChatbotId) {
      try {
        await db.insert(analytics).values({
          chatbotId: effectiveChatbotId,
          eventType: "voice_transcription",
          eventData: {
            audioBytes: validation.size,
            durationSeconds: result.durationSeconds,
            transcriptLength: result.text.length,
            surface: logContext.surface,
          } as typeof analytics.$inferInsert.eventData,
        });
      } catch (err) {
        logError(err, "Failed to record transcription analytics", logContext);
      }
    } else if (userId) {
      // Authenticated request but no resolvable chatbotId (client didn't
      // send one, or sent one the user doesn't own). Transcription still
      // succeeds, but the call is missing from per-chatbot usage rollups
      // — surface it so the gap is auditable rather than silent.
      logWarn("Transcription succeeded without chatbot attribution", {
        ...logContext,
        claimedChatbotId: formData.get("chatbotId") ?? null,
      });
    }

    return NextResponse.json({
      text: result.text,
      language: result.language,
      durationSeconds: result.durationSeconds,
    });
  } catch (err) {
    if (err instanceof TranscriptionError) {
      logError(err, "Transcription provider error", {
        ...logContext,
        reason: err.reason,
      });
      return mapProviderError(err);
    }
    logError(err, "Unexpected transcription error", logContext);
    return jsonError("Transcription failed", "internal_error", 500);
  }
}
