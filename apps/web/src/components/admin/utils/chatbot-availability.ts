export type ChatbotAvailabilityInput = {
  paused: boolean;
  ownerChatbotsPaused: boolean;
  /** The chatbot has used up its own daily limit. */
  isAtLimit: boolean;
  /** Its professor has used up their daily total across all chatbots. */
  isOwnerAtLimit: boolean;
};

/**
 * Why students can't use a chatbot right now, or null when they can. The
 * first reason that applies wins: a pause outlasts the day, a limit resets at
 * midnight, and the chatbot's own state comes before its professor's.
 */
export function chatbotBlockedReason({
  paused,
  ownerChatbotsPaused,
  isAtLimit,
  isOwnerAtLimit,
}: ChatbotAvailabilityInput): string | null {
  if (paused) return "Paused";
  if (ownerChatbotsPaused) return "Paused (all chatbots)";
  if (isAtLimit) return "Limit reached";
  if (isOwnerAtLimit) return "Professor limit reached";
  return null;
}
