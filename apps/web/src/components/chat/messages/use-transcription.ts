"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { mimeToExtension } from "@/lib/transcription-validation";
import { logError } from "@/lib/logger";

// Client-side ceiling for the transcription request, just above the
// server's 90s provider timeout, so a stalled response doesn't pin the
// spinner forever if the server never replies.
const TRANSCRIBE_CLIENT_TIMEOUT_MS = 100_000;

interface UseTranscriptionOptions {
  /** When set, send to /api/transcribe with this shareToken (no auth). */
  shareToken?: string;
  /** Chatbot ID for analytics; required for authenticated callers. */
  chatbotId?: string;
  /** Appends the transcript to the current message rather than replacing it. */
  onTranscript: (text: string) => void;
}

/**
 * Sends a recorded clip to /api/transcribe and delivers the transcript.
 * Tracks mount state and the in-flight request so a Whisper call that
 * outlives the component (navigation, chatbot switch) is aborted and
 * never calls setState on a dead component.
 */
export function useTranscription({
  shareToken,
  chatbotId,
  onTranscript,
}: UseTranscriptionOptions) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const transcribe = useCallback(
    async (blob: Blob) => {
      setIsTranscribing(true);

      // Abort any prior in-flight request before starting a new one, then
      // arm a client-side timeout above the server's provider cap.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const timeoutId = setTimeout(
        () => controller.abort(),
        TRANSCRIBE_CLIENT_TIMEOUT_MS,
      );

      try {
        const form = new FormData();
        // Hint OpenAI with a useful filename; the server validates mime
        // independently so this is informational only. Reuse the shared
        // MIME->extension map so this can't drift from server validation.
        const ext = mimeToExtension(blob.type);
        form.append("audio", blob, `recording.${ext}`);
        if (chatbotId) form.append("chatbotId", chatbotId);

        const url = shareToken
          ? `/api/transcribe?shareToken=${encodeURIComponent(shareToken)}`
          : "/api/transcribe";

        const res = await fetch(url, {
          method: "POST",
          body: form,
          signal: controller.signal,
        });
        // Component unmounted while the request was in flight — drop the
        // result silently rather than toasting/inserting on a dead
        // component.
        if (!mountedRef.current) return;
        if (!res.ok) {
          let rateLimitMessage: string | null = null;
          let code: string | undefined;
          let serverMessage: string | undefined;
          try {
            const data = (await res.json()) as {
              error?: unknown;
              code?: unknown;
            };
            if (typeof data.code === "string") code = data.code;
            if (typeof data.error === "string") serverMessage = data.error;

            if (code === "rate_limited" && serverMessage) {
              rateLimitMessage = serverMessage;
            }
          } catch {
            // ignore JSON parse errors
          }
          logError(
            new Error(`Transcription failed: ${code ?? "unknown"}`),
            "Voice transcription request failed",
            { code, status: res.status, serverMessage },
          );
          if (rateLimitMessage) {
            toast.error(rateLimitMessage);
          } else if (code === "audio_duration_exceeded") {
            toast.error("Recording is too long. Please record a shorter clip.");
          } else if (
            code === "audio_too_large" ||
            code === "request_too_large"
          ) {
            toast.error(
              "Recording is too large. Please record a shorter clip.",
            );
          } else if (code === "audio_invalid") {
            toast.error(
              "That recording couldn't be processed. Please try again.",
            );
          } else if (
            code === "provider_timeout" ||
            code === "provider_unavailable" ||
            code === "provider_error"
          ) {
            toast.error(
              "Voice transcription is temporarily unavailable. Please type your question.",
            );
          } else if (code === "feature_disabled") {
            toast.error(
              "Voice input is currently disabled. Please type your question.",
            );
          } else if (code === "unauthorized") {
            toast.error("Please sign in again to use voice input.");
          } else {
            toast.error(
              "Voice input failed. Please try again or type your question.",
            );
          }
          return;
        }
        const data = (await res.json()) as { text?: unknown };
        if (!mountedRef.current) return;
        if (typeof data.text !== "string" || !data.text.trim()) {
          toast.error("No speech detected. Please try again.");
          return;
        }
        onTranscript(data.text.trim());
      } catch (err) {
        // An aborted request (unmount or client timeout) is expected
        // teardown, not a user-facing failure — stay quiet.
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        logError(err, "Voice transcription request failed");
        if (mountedRef.current) {
          toast.error("Network error. Please try again.");
        }
      } finally {
        clearTimeout(timeoutId);
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        if (mountedRef.current) {
          setIsTranscribing(false);
        }
      }
    },
    [onTranscript, shareToken, chatbotId],
  );

  return { isTranscribing, transcribe };
}
