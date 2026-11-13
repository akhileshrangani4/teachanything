import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { messageRatings } from "@teachanything/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { assertOwnedChatbot } from "@/server/queries/chatbot";
import { DAY_MS } from "../helpers";

/** The ratings card covers a fixed window; the spec rules out a picker. */
export const RATINGS_WINDOW_DAYS = 30;

/** Start of the ratings window ending at `now`. */
export function ratingsWindowStart(now: Date): Date {
  return new Date(now.getTime() - RATINGS_WINDOW_DAYS * DAY_MS);
}

/**
 * Thumbs up and down a chatbot's responses received in the last 30 days.
 * A re-rated message counts once, with its latest value, dated by when it was
 * last rated (`updatedAt`, which the chatbot/time index covers).
 */
export const getRatingsSummaryProcedure = protectedProcedure
  .input(z.object({ chatbotId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    await assertOwnedChatbot(ctx, input.chatbotId);

    const [summary] = await ctx.db
      .select({
        up: sql<number>`count(*) filter (where ${messageRatings.rating} = 'up')::int`,
        down: sql<number>`count(*) filter (where ${messageRatings.rating} = 'down')::int`,
      })
      .from(messageRatings)
      .where(
        and(
          eq(messageRatings.chatbotId, input.chatbotId),
          gte(messageRatings.updatedAt, ratingsWindowStart(new Date())),
        ),
      );

    return { up: summary?.up ?? 0, down: summary?.down ?? 0 };
  });
