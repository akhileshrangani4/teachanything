/**
 * Speech-to-text transcription via OpenAI Whisper.
 *
 * Uses raw fetch against the OpenAI REST API to avoid pulling in the full
 * `openai` SDK as a dependency (we already use `@ai-sdk/openai` for
 * embeddings, but the AI SDK does not cover audio endpoints).
 *
 * Model choice: whisper-1 (request/response) rather than the newer
 * realtime/streaming transcription endpoint. The voice-input UX is
 * record → review → send, not live-dictation, so streaming partial
 * transcripts buys no user-visible win for ≤3-minute clips while
 * requiring WebSocket plumbing, ephemeral tokens, and a separate UI.
 * Upgrade to a streaming model if students report latency complaints.
 */

export interface TranscriptionResult {
  text: string;
  language: string | null;
  durationSeconds: number | null;
}

export interface TranscribeAudioOptions {
  apiKey: string;
  audio: Blob;
  filename: string;
  /**
   * ISO-639-1 code to bias the model toward a specific language. Omit to
   * let Whisper auto-detect. Auto-detect is the documented MVP behavior.
   */
  language?: string;
  /** Network/HTTP timeout in milliseconds. Defaults to 90s. */
  timeoutMs?: number;
}

const OPENAI_TRANSCRIPTIONS_URL =
  "https://api.openai.com/v1/audio/transcriptions";
// Whisper processes audio at roughly 1/3 real-time, so a 3-minute clip
// can take ~60s plus network overhead. 90s leaves slack without making
// users wait forever on a stuck call.
const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Transcribe an audio Blob with OpenAI Whisper.
 *
 * The `verbose_json` response format gives us the detected language and
 * audio duration so the server can record cost-relevant metadata without
 * trusting the client.
 *
 * Throws a `TranscriptionError` on provider failures so callers can
 * distinguish them from generic exceptions.
 */
export async function transcribeAudio({
  apiKey,
  audio,
  filename,
  language,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: TranscribeAudioOptions): Promise<TranscriptionResult> {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  if (language) {
    form.append("language", language);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // The timer stays armed until the response BODY has been consumed —
  // fetch resolves when headers arrive, so disarming there would let a
  // stalled body hang past timeoutMs with no abort covering the read.
  try {
    let response: Response;
    try {
      response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new TranscriptionError(
          "Transcription request timed out",
          "timeout",
        );
      }
      throw new TranscriptionError(
        err instanceof Error ? err.message : "Network error",
        "network",
      );
    }

    if (!response.ok) {
      const status = response.status;
      let bodyText = "";
      try {
        bodyText = await response.text();
      } catch {
        // ignore — the status alone classifies the failure
      }
      throw new TranscriptionError(
        `OpenAI transcription failed (${status})`,
        status === 429 ? "provider_rate_limit" : "provider_error",
        { status, body: bodyText.slice(0, 500) },
      );
    }

    let data: { text?: unknown; language?: unknown; duration?: unknown };
    try {
      data = (await response.json()) as {
        text?: unknown;
        language?: unknown;
        duration?: unknown;
      };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new TranscriptionError(
          "Transcription request timed out",
          "timeout",
        );
      }
      throw new TranscriptionError(
        "Provider returned malformed response",
        "provider_error",
      );
    }

    if (typeof data.text !== "string") {
      throw new TranscriptionError(
        "Provider returned malformed response",
        "provider_error",
      );
    }

    return {
      text: data.text.trim(),
      language: typeof data.language === "string" ? data.language : null,
      durationSeconds:
        typeof data.duration === "number" && Number.isFinite(data.duration)
          ? data.duration
          : null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export type TranscriptionErrorReason =
  | "timeout"
  | "network"
  | "provider_error"
  | "provider_rate_limit";

export class TranscriptionError extends Error {
  readonly reason: TranscriptionErrorReason;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    reason: TranscriptionErrorReason,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "TranscriptionError";
    this.reason = reason;
    this.details = details;
  }
}
