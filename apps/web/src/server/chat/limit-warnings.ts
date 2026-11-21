import { eq } from "drizzle-orm";
import { user } from "@teachanything/db/schema";
import type { db as DbType } from "@teachanything/db";
import {
  claimLimitWarning,
  type DailyCountScope,
  type DailyMessageResult,
} from "@/server/rate-limit";
import {
  sendDailyLimitWarningEmail,
  type LimitWarningThreshold,
} from "@/server/email/daily-limit-warning";
import { logWarn } from "@/lib/logger";

/** One limit a message just brought to a warning threshold. */
export type LimitCrossing = {
  scope: DailyCountScope;
  count: number;
  limit: number;
  threshold: LimitWarningThreshold;
};

type WarnedChatbot = { id: string; name: string; userId: string };

/**
 * The threshold `count` lands exactly on, if any: 100 on the last allowed
 * message, 80 on the message that reaches 80% (rounded up). Exact matches
 * only, so each threshold is crossed by exactly one message a day. For
 * limits of 1 to 4, 80% rounds up to the limit itself, so only 100 applies.
 */
export function warningThreshold(
  count: number,
  limit: number,
): LimitWarningThreshold | null {
  if (count === limit) return 100;
  if (count === Math.ceil(limit * 0.8)) return 80;
  return null;
}

/** The limits an admitted message brought to a warning threshold. */
export function findLimitCrossings(
  counts: { chatbot: number; owner: number },
  limits: { chatbot: number; owner: number },
): LimitCrossing[] {
  const scopes: DailyCountScope[] = ["chatbot", "owner"];
  return scopes.flatMap((scope) => {
    const threshold = warningThreshold(counts[scope], limits[scope]);
    if (threshold === null) return [];
    return [{ scope, count: counts[scope], limit: limits[scope], threshold }];
  });
}

/** The professor's name and email, read only when an email goes out. */
async function readOwnerContact(database: typeof DbType, ownerId: string) {
  const [owner] = await database
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, ownerId))
    .limit(1);
  return owner;
}

/** Claim the day's slot for one crossing and, if won, email the owner. */
async function sendOneWarning(
  database: typeof DbType,
  chatbot: WarnedChatbot,
  crossing: LimitCrossing,
  date: string,
): Promise<void> {
  const id = crossing.scope === "chatbot" ? chatbot.id : chatbot.userId;
  const isClaimed = await claimLimitWarning(
    crossing.scope,
    id,
    crossing.threshold,
    date,
  );
  if (!isClaimed) return;
  const owner = await readOwnerContact(database, chatbot.userId);
  if (!owner?.email) return;
  await sendDailyLimitWarningEmail({
    to: owner.email,
    name: owner.name,
    chatbotName: crossing.scope === "chatbot" ? chatbot.name : null,
    count: crossing.count,
    limit: crossing.limit,
    threshold: crossing.threshold,
  });
}

/**
 * Email the chatbot's owner for every limit this message brought to 80% or
 * 100%. Never throws: each failure is logged, and the chat goes on.
 */
export async function sendLimitWarnings(
  database: typeof DbType,
  chatbot: WarnedChatbot,
  crossings: LimitCrossing[],
  date: string,
): Promise<void> {
  for (const crossing of crossings) {
    try {
      await sendOneWarning(database, chatbot, crossing, date);
    } catch (err) {
      logWarn("Daily limit warning email failed", {
        chatbotId: chatbot.id,
        scope: crossing.scope,
        threshold: crossing.threshold,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Start the heads-up emails for an admitted message without waiting for
 * them, so the student's answer is never delayed by email delivery.
 */
export function warnOnLimitCrossings(
  database: typeof DbType,
  chatbot: WarnedChatbot,
  limits: { chatbot: number; owner: number },
  result: DailyMessageResult,
): void {
  if (!result.isAllowed || !result.counts) return;
  const crossings = findLimitCrossings(result.counts, limits);
  if (crossings.length === 0) return;
  void sendLimitWarnings(database, chatbot, crossings, result.date);
}
