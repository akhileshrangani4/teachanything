import { useEffect, useState } from "react";
import { embedVoiceEnabled, type PolicyDocument } from "@/lib/embed-voice";

/**
 * Whether the embedded chat window should offer voice input. Resolved
 * after mount (same pattern as useEmbedVisibility) so server and client
 * renders never disagree about window state.
 */
export function useEmbedVoice(): boolean {
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  useEffect(() => {
    // Document doesn't declare the (Chromium-only) policy APIs, so widen
    // it to the structural type embed-voice reads.
    setVoiceEnabled(
      embedVoiceEnabled(window.location.search, document as PolicyDocument),
    );
  }, []);

  return voiceEnabled;
}
