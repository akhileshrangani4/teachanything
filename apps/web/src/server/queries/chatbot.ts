/**
 * Chatbot data-access helpers, decoupled from the tRPC layer.
 *
 * These previously lived in `server/routers/chatbot.ts` with a `db` type
 * derived from `protectedProcedure.query`'s internals. That coupled
 * non-tRPC callers (e.g. the `/api/transcribe` Route Handler) to tRPC
 * procedure types, so any change to the procedure shape silently broke
 * the route. Here the `db` parameter is typed against the concrete
 * Drizzle instance from `@teachanything/db`, so both the tRPC router and
 * the route can import these without crossing layers.
 */
import { db } from "@teachanything/db";
import { chatbots } from "@teachanything/db/schema";
import { and, eq } from "drizzle-orm";

export type ChatbotDb = typeof db;

/**
 * Non-throwing lookup: returns the chatbot row when the user owns it, or
 * undefined when the chatbot does not exist or belongs to someone else.
 * Use this from callers that need a soft "is this owned by me?" check —
 * e.g. attributing best-effort analytics where unauthorized claims
 * should be silently dropped rather than 404'd.
 */
export async function findChatbotForUser(
  db: ChatbotDb,
  chatbotId: string,
  userId: string,
) {
  const [chatbot] = await db
    .select()
    .from(chatbots)
    .where(and(eq(chatbots.id, chatbotId), eq(chatbots.userId, userId)))
    .limit(1);
  return chatbot;
}

/**
 * Lightweight ownership probe: returns `{ id }` only when the user owns
 * the chatbot, or undefined otherwise. Prefer this over
 * `findChatbotForUser` on hot paths where you only need to verify
 * ownership for attribution — avoids pulling potentially-large fields
 * like `systemPrompt` across the wire.
 */
export async function findOwnedChatbotId(
  db: ChatbotDb,
  chatbotId: string,
  userId: string,
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: chatbots.id })
    .from(chatbots)
    .where(and(eq(chatbots.id, chatbotId), eq(chatbots.userId, userId)))
    .limit(1);
  return row;
}
