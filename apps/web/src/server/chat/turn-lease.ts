import type { conversations } from "@teachanything/db/schema";
import type { db as DbType } from "@teachanything/db";
import { logError } from "@/lib/logger";
import { swapTurnMarker } from "./turn-marker";

/**
 * How long a claimed turn holds its session. Equals the chat routes'
 * `maxDuration`: by then the function that claimed the turn has been killed,
 * so a marker this old was left behind by a crash and no longer blocks.
 */
export const TURN_LEASE_MS = 300_000;

/** Whether a session's `activeTurnAt` marker still holds the session at `now`. */
export function isTurnInFlight(
  activeTurnAt: string | null | undefined,
  now: number,
): boolean {
  if (!activeTurnAt) return false;
  const claimedAt = Date.parse(activeTurnAt);
  // An unreadable marker can't belong to a live turn, so it doesn't block.
  return Number.isFinite(claimedAt) && now - claimedAt < TURN_LEASE_MS;
}

/** A session's claimed turn. `release` is idempotent and never throws. */
export type TurnLease = { release: () => Promise<void> };

/**
 * Claim the session's turn (#465): set `metadata.activeTurnAt` if it is empty
 * or expired, as a compare-and-set against the marker `conversation` was read
 * with. Returns null when another turn holds the session, or claimed it after
 * that read.
 */
export async function claimTurn(
  database: typeof DbType,
  conversation: Pick<typeof conversations.$inferSelect, "id" | "metadata">,
  now: number = Date.now(),
): Promise<TurnLease | null> {
  const observed = conversation.metadata?.activeTurnAt ?? null;
  if (isTurnInFlight(observed, now)) return null;

  const marker = new Date(now).toISOString();
  const claimed = await swapTurnMarker(
    database,
    conversation.id,
    observed,
    marker,
  );
  if (!claimed) return null;

  let released: Promise<void> | undefined;
  return {
    release: () =>
      (released ??= swapTurnMarker(database, conversation.id, marker, null)
        // A false result means a later turn took over an expired marker; it
        // owns the session now, so there is nothing to clear.
        .then(() => undefined)
        // Logged, not thrown: release runs in stream callbacks that can't
        // surface it, and the lease expiry frees the session anyway.
        .catch((error: unknown) =>
          logError(error, "Failed to release chat turn", {
            conversationId: conversation.id,
          }),
        )),
  };
}
