import type { TFunction } from "i18next";

const MAX_LENGTH = 160;

/** The `code` each chat route error carries, and the message to show for it. */
const CHAT_ERROR_KEYS = {
  rate_limited: "errors.chat.tooManyMessages",
  invalid_request: "errors.chat.invalidRequest",
  message_needs_text: "errors.chat.messageNeedsText",
  conversation_start_failed: "errors.chat.conversationStartFailed",
  unauthorized: "errors.chat.unauthorized",
  pending_approval: "errors.pendingApproval",
  chatbot_not_found: "errors.notFoundItems.chatbot",
  chatbot_not_shared: "errors.notFoundItems.chatbotNotShared",
  send_failed: "errors.chat.sendFailed",
  turn_in_progress: "errors.chat.turnInProgress",
} as const;

export type ChatErrorCode = keyof typeof CHAT_ERROR_KEYS;

/** The AI SDK puts the response body in `error.message`. */
function chatErrorCode(message: string): ChatErrorCode | null {
  try {
    const code = (JSON.parse(message) as { code?: unknown } | null)?.code;
    return typeof code === "string" && Object.hasOwn(CHAT_ERROR_KEYS, code)
      ? (code as ChatErrorCode)
      : null;
  } catch {
    return null;
  }
}

/** The route's error code a failed chat request carries, if any. */
export function chatErrorCodeOf(error: Error): ChatErrorCode | null {
  return chatErrorCode(error.message?.trim() ?? "");
}

export function describeChatError(error: Error, t: TFunction): string {
  const message = error.message?.trim() ?? "";
  const code = chatErrorCode(message);
  if (code) return t(CHAT_ERROR_KEYS[code]);
  if (!message || message.length > MAX_LENGTH || /^[{<[]/.test(message)) {
    return t("errors.chat.sendFailed");
  }
  return message;
}
