import { describe, it, expect } from "@jest/globals";
import {
  TRANSCRIPTION_LIMITS,
  isAllowedAudioMime,
  validateAudioBlob,
} from "@/lib/transcription-validation";

describe("validateAudioBlob", () => {
  it("rejects null/undefined", () => {
    expect(validateAudioBlob(null)).toMatchObject({
      ok: false,
      reason: "missing",
    });
    expect(validateAudioBlob(undefined)).toMatchObject({
      ok: false,
      reason: "missing",
    });
  });

  it("rejects empty file", () => {
    expect(validateAudioBlob({ type: "audio/webm", size: 0 })).toMatchObject({
      ok: false,
      reason: "empty",
    });
  });

  it("rejects files below the minimum size", () => {
    expect(validateAudioBlob({ type: "audio/webm", size: 100 })).toMatchObject({
      ok: false,
      reason: "too_small",
    });
  });

  it("rejects files above the max size", () => {
    expect(
      validateAudioBlob({
        type: "audio/webm",
        size: TRANSCRIPTION_LIMITS.MAX_BYTES + 1,
      }),
    ).toMatchObject({ ok: false, reason: "too_large" });
  });

  it("rejects unsupported MIME types", () => {
    expect(
      validateAudioBlob({ type: "application/octet-stream", size: 10_000 }),
    ).toMatchObject({ ok: false, reason: "unsupported_type" });
  });

  it("strips codec parameters from MIME type before validation", () => {
    const result = validateAudioBlob({
      type: "audio/webm;codecs=opus",
      size: 10_000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mimeType).toBe("audio/webm");
      expect(result.extension).toBe("webm");
    }
  });

  it("accepts each supported MIME family", () => {
    const cases: Array<[string, string]> = [
      ["audio/webm", "webm"],
      ["audio/ogg", "ogg"],
      ["audio/mp4", "mp4"],
      ["audio/mpeg", "mp3"],
      ["audio/mp3", "mp3"],
      ["audio/wav", "wav"],
      ["audio/wave", "wav"],
      ["audio/x-wav", "wav"],
    ];
    for (const [mime, ext] of cases) {
      const r = validateAudioBlob({ type: mime, size: 10_000 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.extension).toBe(ext);
    }
  });

  it("rejects audio/m4a (no browser emits it; mp4 is canonical)", () => {
    expect(
      validateAudioBlob({ type: "audio/m4a", size: 10_000 }),
    ).toMatchObject({ ok: false, reason: "unsupported_type" });
  });
});

describe("isAllowedAudioMime", () => {
  it("returns true for whitelisted types", () => {
    expect(isAllowedAudioMime("audio/webm")).toBe(true);
    expect(isAllowedAudioMime("audio/mp4")).toBe(true);
  });

  it("returns false for unrelated types", () => {
    expect(isAllowedAudioMime("video/mp4")).toBe(false);
    expect(isAllowedAudioMime("text/plain")).toBe(false);
  });

  it("ignores codec parameters", () => {
    expect(isAllowedAudioMime("audio/webm;codecs=opus")).toBe(true);
  });
});
