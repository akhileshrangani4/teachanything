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
import { TRPCError } from "@trpc/server";

export type ChatbotDb = typeof db;

/**
 * Narrowed context for ownership assertions: callers run inside
 * protectedProcedure, so only `db` and the authenticated user id are needed.
 */
export type AuthedChatbotContext = {
  db: ChatbotDb;
  session: { user: { id: string } };
};

/**
 * Fetch a chatbot and verify ownership. Throws NOT_FOUND when the chatbot
 * does not exist or belongs to someone else (never 403 — existence and
 * permission are intentionally indistinguishable to the caller).
 * Use `findChatbotForUser` for the non-throwing variant.
 */
export async function assertOwnedChatbot(
  ctx: AuthedChatbotContext,
  chatbotId: string,
): Promise<typeof chatbots.$inferSelect> {
  const [chatbot] = await ctx.db
    .select()
    .from(chatbots)
    .where(
      and(eq(chatbots.id, chatbotId), eq(chatbots.userId, ctx.session.user.id)),
    )
    .limit(1);

  if (!chatbot) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Chatbot not found",
    });
  }

  return chatbot;
}

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
