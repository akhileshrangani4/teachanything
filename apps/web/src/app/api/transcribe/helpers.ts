import { NextRequest, NextResponse } from "next/server";
import { TRANSCRIPTION_LIMITS } from "@/lib/transcription-validation";
import type { TranscriptionError } from "@teachanything/ai";

/**
 * Stable, machine-readable error codes returned by the transcription
 * endpoint. The client uses these to map errors to localized UI rather
 * than parsing the English `error` message.
 */
export type TranscribeErrorCode =
  | "feature_disabled"
  | "content_length_invalid"
  | "request_too_large"
  | "audio_too_large"
  | "unauthorized"
  | "share_not_found"
  | "rate_limited"
  | "invalid_request"
  | "audio_invalid"
  | "audio_duration_exceeded"
  | "provider_timeout"
  | "provider_unavailable"
  | "provider_error"
  | "internal_error";

export interface TranscribeErrorBody {
  error: string;
  code: TranscribeErrorCode;
}

export function jsonError(
  message: string,
  code: TranscribeErrorCode,
  status: number,
  extraHeaders?: Record<string, string>,
): NextResponse<TranscribeErrorBody> {
  return NextResponse.json(
    { error: message, code },
    { status, headers: extraHeaders },
  );
}

/**
 * Reject oversized or unmeasurable bodies before buffering the request.
 * On Vercel the platform also enforces a body limit at the edge for the
 * default plan, so this is defense-in-depth for self-hosted deploys.
 * Legitimate clients (fetch + MediaRecorder blobs) should set
 * Content-Length, but not all proxies/HTTP/2 paths include it. When
 * Content-Length is absent, we skip the fast-path check and rely on the
 * blob validation to enforce size limits. Returns null when the request
 * should proceed.
 */
export function checkContentLength(
  request: Pick<NextRequest, "headers">,
): NextResponse<TranscribeErrorBody> | null {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) {
    // Missing Content-Length: skip the fast-path check, rely on blob
    // validation. This avoids breaking HTTP/2 or proxy scenarios.
    return null;
  }
  const declared = Number.parseInt(contentLength, 10);
  if (!Number.isFinite(declared) || declared < 0) {
    return jsonError(
      "Invalid Content-Length header",
      "content_length_invalid",
      400,
    );
  }
  // Compare against MAX_REQUEST_BYTES (not MAX_BYTES) — multipart
  // overhead means a request can legitimately exceed the audio cap by a
  // small margin. The audio Blob itself is bounds-checked again later
  // via validateAudioBlob against MAX_BYTES.
  if (declared > TRANSCRIPTION_LIMITS.MAX_REQUEST_BYTES) {
    return jsonError(
      `Request exceeds ${Math.round(TRANSCRIPTION_LIMITS.MAX_REQUEST_BYTES / 1024 / 1024)} MB limit`,
      "request_too_large",
      413,
    );
  }
  return null;
}

/**
 * Map an OpenAI/provider TranscriptionError to the route's JSON error
 * response shape. Kept separate so the route handler stays focused on
 * orchestration and so the mapping can be exercised in unit tests
 * without spinning up the full request lifecycle.
 */
export function mapProviderError(
  err: TranscriptionError,
): NextResponse<TranscribeErrorBody> {
  switch (err.reason) {
    case "timeout":
      return jsonError(
        "Transcription timed out. Please try a shorter clip.",
        "provider_timeout",
        504,
      );
    case "provider_rate_limit":
      return jsonError(
        "Transcription service is temporarily unavailable.",
        "provider_unavailable",
        503,
      );
    case "network":
    case "provider_error":
      return jsonError(
        "Transcription service is temporarily unavailable.",
        "provider_error",
        502,
      );
    default: {
      // Exhaustiveness guard: adding a new TranscriptionErrorReason
      // without handling it here becomes a compile error rather than
      // silently falling through to a generic 502.
      err.reason satisfies never;
      return jsonError(
        "Transcription service is temporarily unavailable.",
        "provider_error",
        502,
      );
    }
  }
}
