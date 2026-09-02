"use client";

import { useCallback, useState } from "react";
import { Mic, Square, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useVoiceRecorder,
  type VoiceRecorderError,
} from "@/hooks/useVoiceRecorder";
import { useTranscription } from "./use-transcription";
import { MicrophoneHelpDialog } from "./microphone-help-dialog";

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
  const [permissionHelpOpen, setPermissionHelpOpen] = useState(false);

  const handleError = useCallback((err: VoiceRecorderError) => {
    if (err.code === "permission_denied") {
      setPermissionHelpOpen(true);
      return;
    }
    toast.error(err.message);
  }, []);

  const { isTranscribing, transcribe } = useTranscription({
    shareToken,
    chatbotId,
    onTranscript,
  });

  const { status, elapsedMs, isSupported, start, stop, cancel } =
    useVoiceRecorder({
      onComplete: transcribe,
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

      <MicrophoneHelpDialog
        open={permissionHelpOpen}
        onOpenChange={setPermissionHelpOpen}
      />
    </>
  );
}
