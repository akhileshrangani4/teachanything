const FALLBACK = "Failed to send message. Please try again.";
const MAX_LENGTH = 160;

export function describeChatError(error: Error): string {
  const message = error.message?.trim();
  if (!message || message.length > MAX_LENGTH || /^[{<[]/.test(message)) {
    return FALLBACK;
  }
  return message;
}
