import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { MessageRatingValue } from "@/components/chat/messages/MessageRating";
import { submitMessageRating } from "@/lib/submit-message-rating";

/** One assistant message's rating as the student sees it. */
export interface MessageRatingState {
  value: MessageRatingValue | null;
  /** A save is in flight; the thumbs are disabled so saves can't reorder. */
  isSaving: boolean;
}

export type MessageRatings = Readonly<Record<string, MessageRatingState>>;

export type RateMessage = (
  messageId: string,
  rating: MessageRatingValue,
) => void;

/** Returns a copy of `ratings` with `messageId` set to `state`. */
export function withMessageRating(
  ratings: MessageRatings,
  messageId: string,
  state: MessageRatingState,
): MessageRatings {
  return { ...ratings, [messageId]: state };
}

/**
 * The student's thumbs up/down for one shared-chat session. Ratings show
 * optimistically and roll back (with a toast) if the save fails. They live
 * only in memory: a reload starts a new session, so nothing is rehydrated.
 */
export function useMessageRatings(shareToken: string, sessionId: string) {
  const { t } = useTranslation();
  const [ratings, setRatings] = useState<MessageRatings>({});
  // Mirrors `ratings` for the handler, so `rateMessage` stays stable for the
  // memoized message rows. Written only in event handlers, never in render.
  const latest = useRef<MessageRatings>({});

  const commit = useCallback((next: MessageRatings) => {
    latest.current = next;
    setRatings(next);
  }, []);

  const rateMessage = useCallback<RateMessage>(
    (messageId, rating) => {
      const previous = latest.current[messageId];
      if (previous?.isSaving) return;
      commit(
        withMessageRating(latest.current, messageId, {
          value: rating,
          isSaving: true,
        }),
      );
      void submitMessageRating({
        shareToken,
        sessionId,
        messageId,
        rating,
      }).then((saved) => {
        commit(
          withMessageRating(latest.current, messageId, {
            value: saved ? rating : (previous?.value ?? null),
            isSaving: false,
          }),
        );
        if (!saved) toast.error(t("chat.message.rating.failed"));
      });
    },
    [commit, shareToken, sessionId, t],
  );

  const resetRatings = useCallback(() => commit({}), [commit]);

  return { ratings, rateMessage, resetRatings };
}
