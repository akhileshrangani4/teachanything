import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@teachanything/db";
import { chatbots, analytics } from "@teachanything/db/schema";
import { eq, and } from "drizzle-orm";
import { findOwnedChatbotId } from "@/server/queries/chatbot";
import type { Ratelimit } from "@upstash/ratelimit";
import {
  transcriptionRateLimit,
  publicTranscriptionRateLimit,
  publicTranscriptionGlobalRateLimit,
  checkRateLimit,
  requireRateLimit,
} from "@/lib/rate-limit";
import {
  TRANSCRIPTION_LIMITS,
  validateAudioBlob,
} from "@/lib/transcription-validation";
import { getTrustedClientIp } from "@/lib/get-client-ip";
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

type Surface = "authenticated" | "shared";

interface AuthContext {
  surface: Surface;
  /**
   * Rate-limit identifier. For authenticated requests this is the user
   * id; for shared requests it's `${shareToken}:${trustedIp}`.
   */
  identifier: string;
  limiter: Ratelimit | null;
  logContext: Record<string, unknown>;
  /**
   * shareToken for the public path. Used to validate the chatbot AFTER
   * the rate-limit check (so the DB lookup is gated by the limiter) and
   * for the per-token global cap. null on the authenticated path.
   */
  shareToken: string | null;
  /** Authenticated user id, when this is a session-based request. */
  userId: string | null;
}

/**
 * Resolve who is calling and which rate-limit bucket applies. An
 * authenticated (and approved) session wins over a shareToken so a
 * logged-in professor browsing their own share link always hits their
 * per-user bucket.
 *
 * IMPORTANT: this does NOT perform the shareToken -> chatbot DB lookup.
 * That lookup is intentionally deferred to AFTER the rate-limit check in
 * the handler so an unauthenticated caller can't drive unbounded DB
 * queries before the limiter runs. We only need the (cheap, header-only)
 * identifier here.
 */
async function resolveAuth(
  request: NextRequest,
): Promise<AuthContext | { error: NextResponse<ErrorResponse> }> {
  const hasCookies = !!request.headers.get("cookie");

  if (hasCookies) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session?.user) {
      // Mirror protectedProcedure: only approved users (admins bypass)
      // get the higher per-user transcription bucket on this paid
      // endpoint. Banned/unapproved sessions are rejected outright rather
      // than silently falling through to the shareToken path, so a banned
      // user can't transcribe at all (anonymous shareToken access is a
      // separate, lower bucket).
      const user = session.user;
      if (user.role !== "admin" && user.status !== "approved") {
        logWarn("Unapproved/banned user attempted transcription", {
          surface: "authenticated",
          userId: user.id,
          status: user.status,
        });
        return {
          error: jsonError(
            "Your account is pending admin approval",
            "unauthorized",
            403,
          ),
        };
      }

      return {
        surface: "authenticated",
        identifier: user.id,
        limiter: transcriptionRateLimit,
        logContext: { surface: "authenticated", userId: user.id },
        shareToken: null,
        userId: user.id,
      };
    }
  }

  const shareToken = new URL(request.url).searchParams.get("shareToken");
  if (!shareToken) {
    return { error: jsonError("Unauthorized", "unauthorized", 401) };
  }

  // Derive the IP from the trusted edge hop (x-real-ip / rightmost XFF),
  // NOT the client-controlled leftmost XFF entry — otherwise a caller can
  // rotate the header to mint unlimited rate-limit buckets.
  const clientIp = getTrustedClientIp(request.headers);
  const identifier = `${shareToken}:${clientIp}`;

  return {
    surface: "shared",
    identifier,
    limiter: publicTranscriptionRateLimit,
    logContext: { surface: "shared", shareToken },
    shareToken,
    userId: null,
  };
}

/**
 * Enforce rate limits for the resolved caller. The public/shared surface
 * is fail-CLOSED: when Redis is unavailable we deny rather than allow,
 * because this is an unauthenticated paid (Whisper) endpoint and a
 * fail-open path turns a Redis outage into a free transcription proxy.
 * Authenticated callers use the fail-open path — they're known users on a
 * bounded per-user bucket, so availability is preferred there.
 *
 * For the shared surface we additionally enforce a per-shareToken global
 * cap (keyed on the token alone, no IP) so total spend attributable to a
 * single link is bounded even if the per-(IP, token) limiter is evaded by
 * IP rotation.
 *
 * Returns null on success, or a 429/internal error response to return.
 */
async function enforceRateLimits(
  ctx: AuthContext,
): Promise<NextResponse<ErrorResponse> | null> {
  if (ctx.surface === "shared") {
    const perIp = await requireRateLimit(ctx.limiter, ctx.identifier, {
      route: "transcribe",
      surface: "shared",
    });
    if (!perIp.success) {
      return rateLimitedResponse(perIp.reset);
    }

    if (ctx.shareToken) {
      const perToken = await requireRateLimit(
        publicTranscriptionGlobalRateLimit,
        ctx.shareToken,
        { route: "transcribe", surface: "shared", scope: "per-share-token" },
      );
      if (!perToken.success) {
        return rateLimitedResponse(perToken.reset);
      }
    }
    return null;
  }

  const { success, reset } = await checkRateLimit(ctx.limiter, ctx.identifier, {
    route: "transcribe",
    surface: "authenticated",
  });
  if (!success) {
    return rateLimitedResponse(reset);
  }
  return null;
}

function rateLimitedResponse(reset: number): NextResponse<ErrorResponse> {
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return jsonError(
    `Too many transcription requests. Please try again in ${retryAfter} seconds.`,
    "rate_limited",
    429,
    { "Retry-After": retryAfter.toString() },
  );
}

/**
 * Resolve the shareToken to an enabled chatbot. Runs AFTER the rate-limit
 * check so the lookup is gated. DB errors are mapped to the JSON error
 * contract (internal_error/500) rather than bubbling up as an HTML 500.
 */
async function validateShareToken(
  shareToken: string,
): Promise<{ chatbotId: string } | { error: NextResponse<ErrorResponse> }> {
  let chatbot: { id: string } | undefined;
  try {
    [chatbot] = await db
      .select({ id: chatbots.id })
      .from(chatbots)
      .where(
        and(
          eq(chatbots.shareToken, shareToken),
          eq(chatbots.sharingEnabled, true),
        ),
      )
      .limit(1);
  } catch (err) {
    logError(err, "Transcribe shareToken lookup failed", {
      surface: "shared",
    });
    return { error: jsonError("Transcription failed", "internal_error", 500) };
  }

  if (!chatbot) {
    return {
      error: jsonError(
        "Chatbot not found or sharing is disabled",
        "share_not_found",
        404,
      ),
    };
  }
  return { chatbotId: chatbot.id };
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
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
