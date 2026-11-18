import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import type { db as DbType } from "@teachanything/db";
import {
  conversations,
  messageRatingEnum,
  messageRatings,
  messages,
} from "@teachanything/db/schema";
import { sessionIdSchema } from "@/server/utils";

/** A student's rating of one assistant message, from a public shared link. */
export const sharedMessageRatingSchema = z.object({
  shareToken: z.string().min(1).max(100),
  sessionId: sessionIdSchema,
  messageId: z.string().uuid(),
  /** null removes the session's earlier rating of this message. */
  rating: z.enum(messageRatingEnum.enumValues).nullable(),
});

export type MessageRating = NonNullable<
  z.infer<typeof sharedMessageRatingSchema>["rating"]
>;

export type RecordMessageRatingResult =
  | { status: "saved" }
  /** No assistant message with that id in this chatbot + session. */
  | { status: "message_not_found" };

/**
 * Save a student's rating of an assistant message, replacing any earlier
 * rating the same session gave it, or remove it when `rating` is null. The message must be an assistant turn of
 * this session's conversation on this chatbot: a session can only rate what it
 * was shown, never another student's conversation.
 *
 * `message_not_found` is also what a rating sent before the turn has persisted
 * gets (the row is written in the stream's onFinish); the client retries it.
 */
export async function recordMessageRating(params: {
  chatbotId: string;
  sessionId: string;
  messageId: string;
  rating: MessageRating | null;
  db: typeof DbType;
}): Promise<RecordMessageRatingResult> {
  const { chatbotId, sessionId, messageId, rating, db } = params;

  const [message] = await db
    .select({ id: messages.id })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(messages.id, messageId),
        eq(messages.role, "assistant"),
        eq(conversations.chatbotId, chatbotId),
        eq(conversations.sessionId, sessionId),
      ),
    )
    .limit(1);
  if (!message) return { status: "message_not_found" };

  if (rating === null) {
    await db
      .delete(messageRatings)
      .where(
        and(
          eq(messageRatings.messageId, messageId),
          eq(messageRatings.sessionId, sessionId),
        ),
      );
    return { status: "saved" };
  }

  await db
    .insert(messageRatings)
    .values({ messageId, chatbotId, sessionId, rating })
    .onConflictDoUpdate({
      target: [messageRatings.messageId, messageRatings.sessionId],
      set: { rating, updatedAt: sql`now()` },
    });
  return { status: "saved" };
}
