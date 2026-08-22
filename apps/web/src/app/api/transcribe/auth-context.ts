import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@teachanything/db";
import { chatbots } from "@teachanything/db/schema";
import { eq, and } from "drizzle-orm";
import type { Ratelimit } from "@upstash/ratelimit";
import {
  transcriptionRateLimit,
  publicTranscriptionRateLimit,
  publicTranscriptionGlobalRateLimit,
  checkRateLimit,
  requireRateLimit,
} from "@/server/rate-limit";
import { getTrustedClientIp } from "@/lib/get-client-ip";
import { logError, logWarn } from "@/lib/logger";
import { jsonError, type TranscribeErrorBody } from "./helpers";

export type ErrorResponse = TranscribeErrorBody;

export type Surface = "authenticated" | "shared";

export interface AuthContext {
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
export async function resolveAuth(
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
export async function enforceRateLimits(
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
export async function validateShareToken(
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
