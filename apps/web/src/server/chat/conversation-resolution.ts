import { eq, and } from "drizzle-orm";
import { conversations } from "@teachanything/db/schema";
import type { db as DbType } from "@teachanything/db";
import { ChatRequestError } from "./request";

/**
 * Get or create the conversation for this session.
 *
 * The insert tolerates a concurrent first message for the same session
 * (onConflictDoNothing); when it loses that race the row is re-read before the
 * turn is rejected.
 */
export async function resolveConversation(
  database: typeof DbType,
  chatbotId: string,
  sessionId: string,
): Promise<typeof conversations.$inferSelect> {
  const existing = await database
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.chatbotId, chatbotId),
        eq(conversations.sessionId, sessionId),
      ),
    )
    .limit(1);
  let conversation = existing[0];
  if (!conversation) {
    const [created] = await database
      .insert(conversations)
      .values({ chatbotId, sessionId, metadata: {} })
      .onConflictDoNothing()
      .returning();
    conversation = created;
  }
  if (!conversation) {
    const [retry] = await database
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.chatbotId, chatbotId),
          eq(conversations.sessionId, sessionId),
        ),
      )
      .limit(1);
    conversation = retry;
  }
  if (!conversation) {
    // Reached only when the insert lost a concurrent-create race AND the
    // re-read still found nothing — i.e. the session could neither be
    // created nor found, so "already in use" would be misleading.
    throw new ChatRequestError(
      "Could not start this conversation. Please try again.",
      409,
    );
  }
  return conversation;
}
