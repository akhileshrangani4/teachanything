import type { Dispatch, SetStateAction } from "react";
import { chatErrorCodeOf } from "@/lib/chat-error-message";
import type { StudyUIMessage } from "@/server/chat/study-tools";
import { extractText } from "./ui-messages";

/**
 * Drop the optimistic user message the server refused to answer (409
 * `turn_in_progress`), so the transcript shows only messages it kept. Leaves
 * the list unchanged unless that message, with exactly `text`, is last.
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
 * When `error` is a refused turn (another turn holds the session, #465), the
 * message was never answered: take it out of the transcript and hand its text
 * back as the draft, unless the student has typed a new one since. Returns
 * whether `error` was a refused turn.
 */
export function restoreRefusedTurn(
  error: Error,
  sentText: string,
  setMessages: (
    update: (messages: StudyUIMessage[]) => StudyUIMessage[],
  ) => void,
  setDraft: Dispatch<SetStateAction<string>>,
): boolean {
  if (chatErrorCodeOf(error) !== "turn_in_progress") return false;
  setMessages((messages) => withdrawRefusedMessage(messages, sentText));
  setDraft((draft) => draft || sentText);
  return true;
}
