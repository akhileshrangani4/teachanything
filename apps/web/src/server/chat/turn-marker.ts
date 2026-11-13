import { and, eq, sql } from "drizzle-orm";
import { conversations } from "@teachanything/db/schema";
import type { db as DbType } from "@teachanything/db";

/**
 * Compare-and-set on a conversation's `metadata.activeTurnAt` marker: write
 * `next` (null removes the key) only if the marker still holds `expected`
 * (null = no marker). Returns whether the write happened.
 *
 * One UPDATE, so the check and the write are atomic: of two concurrent swaps
 * from the same `expected`, Postgres row-locks the first, then re-checks the
 * second's WHERE against the committed row, which no longer matches.
 */
export async function swapTurnMarker(
  database: typeof DbType,
  conversationId: string,
  expected: string | null,
  next: string | null,
): Promise<boolean> {
  const metadata = sql`coalesce(${conversations.metadata}, '{}'::jsonb)`;
  const rows = await database
    .update(conversations)
    .set({
      metadata:
        next === null
          ? sql`${metadata} - 'activeTurnAt'`
          : sql`${metadata} || jsonb_build_object('activeTurnAt', ${next}::text)`,
    })
    .where(
      and(
        eq(conversations.id, conversationId),
        sql`${conversations.metadata} ->> 'activeTurnAt' is not distinct from ${expected}::text`,
      ),
    )
    .returning({ id: conversations.id });
  return rows.length > 0;
}
