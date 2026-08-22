export type VoiceRecorderStatus =
  | "idle"
  | "requesting_permission"
  | "recording"
  | "stopping";

export type VoiceRecorderErrorCode =
  | "unsupported"
  | "permission_denied"
  | "no_microphone"
  | "recorder_failed"
  | "no_audio";

export interface VoiceRecorderError {
  code: VoiceRecorderErrorCode;
  message: string;
}

export interface UseVoiceRecorderOptions {
  /** Hard cap before the recorder auto-stops. Defaults to 3 minutes. */
  maxDurationMs?: number;
  onComplete: (audio: Blob) => void;
  onError?: (err: VoiceRecorderError) => void;
}

export interface UseVoiceRecorderResult {
  status: VoiceRecorderStatus;
  elapsedMs: number;
  isSupported: boolean;
  start: () => Promise<void>;
  stop: () => void;
  cancel: () => void;
}
