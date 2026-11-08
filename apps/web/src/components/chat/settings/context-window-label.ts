import type { TFunction } from "i18next";

/** A model's context window, e.g. "128K context" or "1M context". */
export function contextWindowLabel(t: TFunction, tokens: number): string {
  return tokens >= 1_000_000
    ? t("chatbotSettings.configuration.contextWindowM", {
        size: Math.round(tokens / 1_000_000),
      })
    : t("chatbotSettings.configuration.contextWindowK", {
        size: Math.round(tokens / 1024),
      });
}
