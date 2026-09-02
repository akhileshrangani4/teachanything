import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@teachanything/db";
import { analytics } from "@teachanything/db/schema";
import { findOwnedChatbotId } from "@/server/queries/chatbot";
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
import {
  enforceRateLimits,
  resolveAuth,
  validateShareToken,
} from "./auth-context";

export interface TranscribeSuccessResponse {
  text: string;
  language: string | null;
  durationSeconds: number | null;
}

/**
 * Full orchestration for POST /api/transcribe: feature gate, body checks,
 * auth + rate limiting (ordered so DB work is gated by the limiter),
 * audio validation, provider call with post-call duration cap, and
 * best-effort analytics. Kept out of route.ts so the entry point stays a
 * thin handler and this flow can be exercised end-to-end in tests.
 */
export async function handleTranscribe(
  request: NextRequest,
): Promise<NextResponse<TranscribeSuccessResponse | TranscribeErrorBody>> {
  if (env.NEXT_PUBLIC_VOICE_INPUT_ENABLED === "false") {
    // 503 (service unavailable) + Retry-After reads as an intentional
    // kill switch rather than a missing endpoint (404). Clients key off
    // the `code` field, so the UI is unaffected either way.
    return jsonError("Voice input is disabled", "feature_disabled", 503, {
      "Retry-After": "3600",
    });
  }

  const lengthError = checkContentLength(request);
  if (lengthError) return lengthError;

  const authResult = await resolveAuth(request);
  if ("error" in authResult) return authResult.error;
  const authCtx = authResult;
  const { logContext, surface, shareToken, userId } = authCtx;

  // Rate-limit BEFORE any DB lookups so expensive queries are gated.
  const rateLimitError = await enforceRateLimits(authCtx);
  if (rateLimitError) return rateLimitError;

  // Now (and only now) resolve the shareToken to a chatbot. Authenticated
  // attribution is resolved later from the form body.
  let inferredChatbotId: string | null = null;
  if (surface === "shared" && shareToken) {
    const shareResult = await validateShareToken(shareToken);
    if ("error" in shareResult) return shareResult.error;
    inferredChatbotId = shareResult.chatbotId;
    logContext.chatbotId = inferredChatbotId;
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
    // Map validation failures to distinct codes/statuses for proper client handling
    switch (validation.reason) {
      case "missing":
      case "empty":
        return jsonError(validation.message, "audio_invalid", 400);
      case "too_small":
        return jsonError(validation.message, "audio_invalid", 400);
      case "too_large":
        return jsonError(validation.message, "audio_too_large", 413);
      case "unsupported_type":
        return jsonError(validation.message, "audio_invalid", 400);
    }
  }

  // Resolve the chatbot this transcription is attributed to for
  // analytics. Shared path: trust the chatbot resolved from the
  // shareToken. Authenticated path: trust the client-supplied id only
  // after verifying it belongs to this user. The ownership lookup is
  // wrapped so a DB failure returns the JSON error contract.
  let effectiveChatbotId: string | null = inferredChatbotId;
  if (!effectiveChatbotId && userId) {
    // Validate the shape BEFORE querying: chatbots.id is a Postgres uuid
    // column, so a non-UUID string would make the cast throw (22P02) and
    // fail the whole request 500 — but this field is only best-effort
    // analytics attribution, and a malformed id can't match a chatbot
    // anyway, so it's skipped exactly like an unowned one.
    const claimed = z.string().uuid().safeParse(formData.get("chatbotId"));
    if (claimed.success) {
      try {
        const owned = await findOwnedChatbotId(db, claimed.data, userId);
        if (owned) effectiveChatbotId = owned.id;
      } catch (err) {
        logError(err, "Transcribe chatbot ownership lookup failed", logContext);
        return jsonError("Transcription failed", "internal_error", 500);
      }
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
    if (effectiveChatbotId) {
      try {
        await db.insert(analytics).values({
          chatbotId: effectiveChatbotId,
          eventType: "voice_transcription",
          eventData: {
            audioBytes: validation.size,
            durationSeconds: result.durationSeconds,
            transcriptLength: result.text.length,
            surface,
          },
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
