import { CHARS_PER_TOKEN } from "@teachanything/ai";
import { logWarn } from "@/lib/logger";

/**
 * Cached token counter -- initialized once, reused across requests. Mirrors the
 * lazy tiktoken init (char/4 fallback if the encoder won't load).
 */
let counterPromise: Promise<(text: string) => number> | null = null;

export async function initTokenCounter(): Promise<(text: string) => number> {
  if (!counterPromise) {
    counterPromise = (async () => {
      try {
        const { getEncoding } = await import("js-tiktoken");
        const encoder = getEncoding("o200k_base");
        return (text: string) => encoder.encode(text).length;
      } catch {
        logWarn("Failed to initialize tiktoken encoder, using char/4 fallback");
        return (text: string) => Math.ceil(text.length / CHARS_PER_TOKEN);
      }
    })();
  }
  return counterPromise;
}
