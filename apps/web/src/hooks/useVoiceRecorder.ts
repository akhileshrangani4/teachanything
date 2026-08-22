import { useCallback, useEffect, useRef, useState } from "react";
import type {
  UseVoiceRecorderOptions,
  UseVoiceRecorderResult,
  VoiceRecorderErrorCode,
  VoiceRecorderStatus,
} from "./voice-recorder-types";
import {
  chooseMimeType,
  isSupportedEnvironment,
} from "./voice-recorder-support";

export type {
  VoiceRecorderStatus,
  VoiceRecorderErrorCode,
  VoiceRecorderError,
} from "./voice-recorder-types";

export function useVoiceRecorder({
  maxDurationMs = 180_000,
  onComplete,
  onError,
}: UseVoiceRecorderOptions): UseVoiceRecorderResult {
  const [status, setStatus] = useState<VoiceRecorderStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isSupported, setIsSupported] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const cancelledRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchronous guard so double-clicks can't open two concurrent
  // getUserMedia() calls. `status` is async-set via setState and can't
  // be trusted as a lock.
  const startingRef = useRef(false);

  // Hold the latest onComplete in a ref so the recorder's `stop` listener
  // always calls the current handler — a parent that swaps onTranscript
  // mid-recording delivers the transcript to the new handler — without
  // putting onComplete in `start`'s dep array (which would recreate
  // `start` on every parent render).
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    setIsSupported(isSupportedEnvironment());
  }, []);

  const cleanup = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = null;
    startingRef.current = false;
  }, []);

  // Mark the hook as unmounted so any in-flight `stop` event from the
  // MediaRecorder can short-circuit before calling onComplete on a
  // component that no longer exists.
  const unmountedRef = useRef(false);

  // Stop tracks if the component using this hook unmounts mid-recording.
  useEffect(() => {
    // Reset on (re)mount. React StrictMode (dev) runs mount -> cleanup ->
    // re-mount; without this reset the cleanup's `unmountedRef = true` would
    // stick for the whole session, so the post-getUserMedia guard in `start`
    // would trip after the user grants the mic and leave the button spinning
    // on `requesting_permission` forever (dev-only, but that's localhost).
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      cleanup();
    };
  }, [cleanup]);

  const emitError = useCallback(
    (code: VoiceRecorderErrorCode, message: string) => {
      onError?.({ code, message });
    },
    [onError],
  );

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === "inactive") return;
    setStatus("stopping");
    try {
      recorder.stop();
    } catch {
      // ignore; cleanup below handles it
    }
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    stop();
  }, [stop]);

  const start = useCallback(async () => {
    if (!isSupportedEnvironment()) {
      emitError(
        "unsupported",
        "Voice input is not supported in this browser. Please type your message.",
      );
      return;
    }
    // Synchronous lock — `status` reads aren't reliable across rapid
    // double-clicks because setStatus is async.
    if (startingRef.current || recorderRef.current) return;
    startingRef.current = true;

    setStatus("requesting_permission");
    cancelledRef.current = false;
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      // Unmounted while the permission prompt was open — don't emit
      // errors or set state on a dead component.
      if (unmountedRef.current) {
        startingRef.current = false;
        return;
      }
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        emitError(
          "permission_denied",
          "Microphone access was blocked. Enable mic access in your browser or device settings, or just type your question.",
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        emitError(
          "no_microphone",
          "No microphone found. Connect a mic or type your question.",
        );
      } else {
        emitError(
          "recorder_failed",
          "Could not start recording. Please try again or type your question.",
        );
      }
      startingRef.current = false;
      setStatus("idle");
      return;
    }

    // Unmounted while the permission prompt was open — the unmount
    // cleanup already ran against empty refs and can never see this
    // late-arriving stream, so release the mic here or it stays hot
    // (recording, indicator lit) with no owner until the max-duration
    // timer would have fired.
    if (unmountedRef.current) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      startingRef.current = false;
      return;
    }

    streamRef.current = stream;
    const mimeType = chooseMimeType();

    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      cleanup();
      emitError(
        "recorder_failed",
        "Could not start recording in this browser.",
      );
      setStatus("idle");
      return;
    }

    recorderRef.current = recorder;

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    });

    recorder.addEventListener("error", () => {
      cleanup();
      setStatus("idle");
      setElapsedMs(0);
      emitError("recorder_failed", "Recording failed. Please try again.");
    });

    recorder.addEventListener("stop", () => {
      const chunks = chunksRef.current;
      const wasCancelled = cancelledRef.current;
      // Prefer the recorder's own reported type (most accurate, reflects
      // what was actually negotiated) over the requested mimeType — when
      // we didn't pass one, the browser picks a default and we need to
      // honor that. Strip the `;codecs=...` parameter so the Blob carries
      // just the container the server validates against.
      const recordedType =
        recorder.mimeType ||
        (chunks[0] instanceof Blob ? chunks[0].type : "") ||
        mimeType ||
        "audio/webm";
      const blobType = recordedType.split(";")[0] || "audio/webm";
      const blob = new Blob(chunks, { type: blobType });

      // Tear down tracks/timers/refs first so the mic is released even if
      // the consumer's onComplete throws below.
      cleanup();

      // Component unmounted while recording was wrapping up — silently
      // drop the result instead of calling setState/onComplete on a
      // dead consumer.
      if (unmountedRef.current) return;

      setStatus("idle");
      setElapsedMs(0);

      if (wasCancelled) return;
      if (blob.size === 0) {
        emitError("no_audio", "No audio was captured. Please try again.");
        return;
      }
      // Call the latest handler via ref. Guard so a synchronous throw in
      // the consumer doesn't surface as an unhandled error in the media
      // event listener.
      try {
        onCompleteRef.current(blob);
      } catch (err) {
        emitError(
          "recorder_failed",
          err instanceof Error
            ? err.message
            : "Failed to process the recording. Please try again.",
        );
      }
    });

    try {
      // 1-second timeslice flushes chunks periodically so memory grows
      // linearly rather than holding the entire clip in one Blob. The
      // final Blob is still assembled from the chunk array on stop().
      recorder.start(1000);
    } catch {
      cleanup();
      setStatus("idle");
      emitError("recorder_failed", "Recording could not start.");
      return;
    }

    startedAtRef.current = Date.now();
    // Recorder is now live; reentry is blocked by recorderRef from here.
    startingRef.current = false;
    setStatus("recording");
    setElapsedMs(0);

    tickRef.current = setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsedMs(Date.now() - startedAtRef.current);
      }
      // 1s cadence: the timer display is MM:SS, so sub-second ticks just
      // burn renders (~1800 over a 3-min clip) with no visible change.
    }, 1000);

    maxTimerRef.current = setTimeout(() => {
      // Auto-stop when the cap is hit; user intent is preserved (not cancelled).
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        stop();
      }
    }, maxDurationMs);
  }, [cleanup, emitError, maxDurationMs, stop]);

  return { status, elapsedMs, isSupported, start, stop, cancel };
}
