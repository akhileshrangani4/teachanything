/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import type { NextRequest } from "next/server";
import { TRANSCRIPTION_LIMITS } from "@/lib/transcription-validation";
import {
  checkContentLength,
  mapProviderError,
} from "@/app/api/transcribe/helpers";
import { TranscriptionError } from "@teachanything/ai";

// Minimal NextRequest stub. checkContentLength only reads the
// content-length header — building a real NextRequest pulls in Web
// platform globals (Request, etc.) that jsdom lacks; the @jest-environment
// node directive above plus this stub avoids that overhead.
function mkRequest(contentLength: string | null): NextRequest {
  return {
    headers: {
      get(name: string) {
        if (name.toLowerCase() === "content-length") return contentLength;
        return null;
      },
    },
  } as unknown as NextRequest;
}

describe("checkContentLength", () => {
  it("returns 411 when Content-Length is missing", async () => {
    const res = checkContentLength(mkRequest(null));
    expect(res?.status).toBe(411);
    const body = (await res?.json()) as { code: string };
    expect(body.code).toBe("content_length_required");
  });

  it("returns 400 when Content-Length is not a number", async () => {
    const res = checkContentLength(mkRequest("abc"));
    expect(res?.status).toBe(400);
    const body = (await res?.json()) as { code: string };
    expect(body.code).toBe("content_length_invalid");
  });

  it("returns 400 when Content-Length is negative", () => {
    const res = checkContentLength(mkRequest("-1"));
    expect(res?.status).toBe(400);
  });

  it("returns 413 when Content-Length exceeds MAX_REQUEST_BYTES", async () => {
    const tooBig = String(TRANSCRIPTION_LIMITS.MAX_REQUEST_BYTES + 1);
    const res = checkContentLength(mkRequest(tooBig));
    expect(res?.status).toBe(413);
    const body = (await res?.json()) as { code: string };
    expect(body.code).toBe("request_too_large");
  });

  it("returns null when Content-Length is within limit", () => {
    const res = checkContentLength(mkRequest("100000"));
    expect(res).toBeNull();
  });

  it("returns null when audio is at MAX_BYTES with envelope overhead", () => {
    // Audio at the exact audio cap, plus a realistic multipart envelope,
    // should fit within MAX_REQUEST_BYTES.
    const envelopeOverhead = 2048;
    const res = checkContentLength(
      mkRequest(String(TRANSCRIPTION_LIMITS.MAX_BYTES + envelopeOverhead)),
    );
    expect(res).toBeNull();
  });

  it("returns null at exactly MAX_REQUEST_BYTES", () => {
    const res = checkContentLength(
      mkRequest(String(TRANSCRIPTION_LIMITS.MAX_REQUEST_BYTES)),
    );
    expect(res).toBeNull();
  });
});

describe("mapProviderError", () => {
  it("returns 504 + provider_timeout for timeout errors", async () => {
    const res = mapProviderError(new TranscriptionError("t", "timeout"));
    expect(res.status).toBe(504);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("provider_timeout");
  });

  it("returns 503 + provider_unavailable for provider rate limit", async () => {
    const res = mapProviderError(
      new TranscriptionError("rl", "provider_rate_limit"),
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("provider_unavailable");
  });

  it("returns 502 + provider_error for generic provider errors", async () => {
    const res = mapProviderError(
      new TranscriptionError("err", "provider_error"),
    );
    expect(res.status).toBe(502);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("provider_error");
  });

  it("returns 502 + provider_error for network errors", async () => {
    const res = mapProviderError(new TranscriptionError("net", "network"));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("provider_error");
  });
});
