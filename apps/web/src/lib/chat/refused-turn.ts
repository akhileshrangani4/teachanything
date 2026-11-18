import type { Dispatch, SetStateAction } from "react";
import { chatErrorCodeOf, type ChatErrorCode } from "@/lib/chat-error-message";
import type { StudyUIMessage } from "@/server/chat/study-tools";
import { extractText } from "./ui-messages";

/**
 * Codes for a message the server refused before saving it: another turn holds
 * the session (#465), or the chatbot is past its daily message limit.
 */
const REFUSED_TURN_CODES: ReadonlySet<ChatErrorCode> = new Set([
  "turn_in_progress",
  "daily_limit_reached",
]);

/**
 * Drop the optimistic user message the server refused to answer, so the
 * transcript shows only messages it kept. Leaves the list unchanged unless that
 * message, with exactly `text`, is last.
 */
export function withdrawRefusedMessage(
  messages: StudyUIMessage[],
  text: string,
): StudyUIMessage[] {
  const last = messages.at(-1);
  return last?.role === "user" && extractText(last.parts) === text
    ? messages.slice(0, -1)
    : messages;
}

/**
 * When `error` is a refused turn (see `REFUSED_TURN_CODES`), the message was
 * never answered: take it out of the transcript and hand its text back as the
 * draft, unless the student has typed a new one since. Returns whether `error`
 * was a refused turn.
 */
export function restoreRefusedTurn(
  error: Error,
  sentText: string,
  setMessages: (
    update: (messages: StudyUIMessage[]) => StudyUIMessage[],
  ) => void,
  setDraft: Dispatch<SetStateAction<string>>,
): boolean {
  const code = chatErrorCodeOf(error);
  if (!code || !REFUSED_TURN_CODES.has(code)) return false;
  setMessages((messages) => withdrawRefusedMessage(messages, sentText));
  setDraft((draft) => draft || sentText);
  return true;
}
