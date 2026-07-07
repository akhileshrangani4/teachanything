/**
 * Server-side validation for inbound transcription audio payloads.
 * Pure functions only — kept separate from the route handler so the
 * rules can be unit-tested without spinning up Next.js.
 */

export const TRANSCRIPTION_LIMITS = {
  // Audio Blob ceiling. 3 minutes of compressed speech (opus/aac) is
  // ~1-2MB; 6MB leaves headroom for higher-bitrate WAV/PCM while still
  // capping payload size.
  MAX_BYTES: 6 * 1024 * 1024,
  // Request body ceiling. Slightly larger than MAX_BYTES to leave room
  // for the multipart envelope (boundary delimiters, headers, the
  // optional `chatbotId` field) without false-positive 413s when the
  // audio itself is right at the audio cap. ~64KB overhead is generous.
  MAX_REQUEST_BYTES: 6 * 1024 * 1024 + 64 * 1024,
  MIN_BYTES: 1024,
  MAX_DURATION_SECONDS: 180,
  // Server-side duration ceiling: anything beyond this is rejected even
  // if the bytes fit, because Whisper bills per audio second.
  MAX_DURATION_SECONDS_WITH_GRACE: 190,
} as const;

// Real-world MIME types produced by MediaRecorder across browsers.
// Chrome/Firefox emit audio/webm (with opus codec parameter); Safari
// emits audio/mp4. WAV/MP3 are included for non-browser clients and
// because OpenAI accepts them.
const ALLOWED_MIME_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
]);

const MIME_TO_EXTENSION: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
};

/**
 * Map an audio MIME type to a file extension for the OpenAI filename hint.
 * Strips any `;codecs=...` parameter before lookup. Falls back to "webm"
 * for unknown types. Single source of truth so the client and server
 * don't drift on the extension mapping.
 */
export function mimeToExtension(rawMime: string): string {
  return MIME_TO_EXTENSION[normalizeMimeType(rawMime)] ?? "webm";
}

export type AudioValidationError =
  | { ok: false; reason: "missing"; message: string }
  | { ok: false; reason: "empty"; message: string }
  | { ok: false; reason: "too_small"; message: string }
  | { ok: false; reason: "too_large"; message: string }
  | { ok: false; reason: "unsupported_type"; message: string };

export type AudioValidationResult =
  | { ok: true; mimeType: string; size: number; extension: string }
  | AudioValidationError;

/**
 * Normalize provider-returned MIME types. Browsers add `;codecs=...` to
 * `audio/webm`; we strip the parameter before lookup.
 */
function normalizeMimeType(raw: string): string {
  const idx = raw.indexOf(";");
  const base = (idx === -1 ? raw : raw.slice(0, idx)).trim().toLowerCase();
  return base;
}

export function validateAudioBlob(
  file: { type?: string; size: number } | null | undefined,
): AudioValidationResult {
  if (!file) {
    return {
      ok: false,
      reason: "missing",
      message: "No audio file provided",
    };
  }

  if (file.size === 0) {
    return {
      ok: false,
      reason: "empty",
      message: "Audio file is empty",
    };
  }

  if (file.size < TRANSCRIPTION_LIMITS.MIN_BYTES) {
    return {
      ok: false,
      reason: "too_small",
      message: "Recording is too short. Please try again.",
    };
  }

  if (file.size > TRANSCRIPTION_LIMITS.MAX_BYTES) {
    return {
      ok: false,
      reason: "too_large",
      message: `Audio exceeds ${TRANSCRIPTION_LIMITS.MAX_BYTES / 1024 / 1024} MB limit`,
    };
  }

  const mime = normalizeMimeType(file.type ?? "");
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return {
      ok: false,
      reason: "unsupported_type",
      message: `Unsupported audio type: ${file.type || "unknown"}`,
    };
  }

  return {
    ok: true,
    mimeType: mime,
    size: file.size,
    extension: MIME_TO_EXTENSION[mime] ?? "webm",
  };
}

export function isAllowedAudioMime(mime: string): boolean {
  return ALLOWED_MIME_TYPES.has(normalizeMimeType(mime));
}
