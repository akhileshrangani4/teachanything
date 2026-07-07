"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useVoiceRecorder,
  type VoiceRecorderError,
} from "@/hooks/useVoiceRecorder";
import { mimeToExtension } from "@/lib/transcription-validation";
import { logError } from "@/lib/logger";

// Client-side ceiling for the transcription request, just above the
// server's 90s provider timeout, so a stalled response doesn't pin the
// spinner forever if the server never replies.
const TRANSCRIBE_CLIENT_TIMEOUT_MS = 100_000;

interface VoiceInputButtonProps {
  disabled?: boolean;
  /** When set, send to /api/transcribe with this shareToken (no auth). */
  shareToken?: string;
  /** Chatbot ID for analytics; required for authenticated callers. */
  chatbotId?: string;
  /** Appends the transcript to the current message rather than replacing it. */
  onTranscript: (text: string) => void;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function VoiceInputButton({
  disabled,
  shareToken,
  chatbotId,
  onTranscript,
}: VoiceInputButtonProps) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [permissionHelpOpen, setPermissionHelpOpen] = useState(false);

  // Track mount state and the in-flight request so a Whisper call that
  // outlives the component (navigation, chatbot switch) is aborted and
  // never calls setState on a dead component.
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const handleError = useCallback((err: VoiceRecorderError) => {
    if (err.code === "permission_denied") {
      setPermissionHelpOpen(true);
      return;
    }
    toast.error(err.message);
  }, []);

  const handleComplete = useCallback(
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

  const { status, elapsedMs, isSupported, start, stop, cancel } =
    useVoiceRecorder({
      onComplete: handleComplete,
      onError: handleError,
    });

  if (!isSupported) {
    return null;
  }

  const isRecording = status === "recording";
  const isBusy =
    isTranscribing ||
    status === "requesting_permission" ||
    status === "stopping";

  return (
    <>
      <div className="flex items-center gap-1">
        {isRecording ? (
          <>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={cancel}
              aria-label="Cancel recording"
              title="Cancel"
              className="h-8 w-8 md:h-9 md:w-9 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={stop}
              aria-label="Stop recording"
              title={`Stop recording (${formatElapsed(elapsedMs)})`}
              className="h-8 w-8 md:h-9 md:w-9 rounded-full"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
            <span
              aria-live="polite"
              className="text-xs tabular-nums text-muted-foreground min-w-[2.5rem]"
            >
              {formatElapsed(elapsedMs)}
            </span>
          </>
        ) : (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={disabled || isBusy}
            onClick={start}
            aria-label={
              isTranscribing ? "Transcribing audio" : "Start voice input"
            }
            title="Voice input"
            className="h-8 w-8 md:h-9 md:w-9 rounded-full"
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      <Dialog open={permissionHelpOpen} onOpenChange={setPermissionHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Microphone access is blocked</DialogTitle>
            <DialogDescription>
              You can still type your question. To use voice input, allow
              microphone access:
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm space-y-3">
            <div>
              <p className="font-medium">Desktop browsers</p>
              <p className="text-muted-foreground">
                Click the lock or site-info icon in the address bar, find
                Microphone, and switch it to Allow. Then reload the page.
              </p>
            </div>
            <div>
              <p className="font-medium">iPhone &amp; iPad (Safari)</p>
              <p className="text-muted-foreground">
                Open the Settings app, scroll to Safari, tap Microphone, and
                allow this site. Reload the page.
              </p>
            </div>
            <div>
              <p className="font-medium">Android (Chrome)</p>
              <p className="text-muted-foreground">
                Tap the lock icon next to the URL, then Permissions, then
                Microphone, and choose Allow. Reload the page.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setPermissionHelpOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
