import type { MessageRatingValue } from "@/components/chat/messages/MessageRating";
import { postWithPersistRetry } from "@/lib/post-with-persist-retry";

export type SubmitMessageRatingInput = {
  shareToken: string;
  sessionId: string;
  /** The assistant message id the student was streamed (and is shown). */
  messageId: string;
  rating: MessageRatingValue;
};

/**
 * Save a student's thumbs up/down on an assistant message. The thumbs show as
 * soon as the reply finishes streaming, which can beat the server's onFinish
 * commit of that message; the endpoint then answers 404 and
 * `postWithPersistRetry` retries it. Never throws: resolves `false` when the
 * rating couldn't be saved (already logged), so the caller can roll back its
 * optimistic state.
 */
export function submitMessageRating(
  input: SubmitMessageRatingInput,
): Promise<boolean> {
  return postWithPersistRetry(
    "/api/message-rating/shared",
    input,
    "Failed to save message rating",
  );
}
