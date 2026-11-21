import {
  claimLimitWarning,
  type DailyCountScope,
  type DailyMessageResult,
} from "@/server/rate-limit";
import { sendDailyLimitWarningEmail } from "@/server/email/daily-limit-warning";
import {
  LIMIT_WARNING_PERCENT,
  type LimitWarningThreshold,
} from "@/lib/constants/rate-limits";
import { logWarn } from "@/lib/logger";

/** One limit a message just brought to a warning threshold. */
export type LimitCrossing = {
  scope: DailyCountScope;
  count: number;
  limit: number;
  threshold: LimitWarningThreshold;
};

type WarnedChatbot = { id: string; name: string; userId: string };

/** The professor a warning is addressed to. */
export type WarnedOwner = { name: string | null; email: string | null };

/**
 * The threshold `count` lands exactly on, if any: 100 on the last allowed
 * message, `LIMIT_WARNING_PERCENT` (80) on the message that reaches that share
 * (rounded up). Exact matches
 * only, so each threshold is crossed by exactly one message a day. For
 * limits of 1 to 4, 80% rounds up to the limit itself, so only 100 applies.
 */
export function warningThreshold(
  count: number,
  limit: number,
): LimitWarningThreshold | null {
  if (count === limit) return 100;
  if (count === Math.ceil((limit * LIMIT_WARNING_PERCENT) / 100)) {
    return LIMIT_WARNING_PERCENT;
  }
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

/** Claim the day's slot for one crossing and, if won, email the owner. */
async function sendOneWarning(
  chatbot: WarnedChatbot,
  owner: WarnedOwner,
  crossing: LimitCrossing,
  date: string,
): Promise<void> {
  const { email } = owner;
  if (!email) return;
  const id = crossing.scope === "chatbot" ? chatbot.id : chatbot.userId;
  const isClaimed = await claimLimitWarning(
    crossing.scope,
    id,
    crossing.threshold,
    date,
  );
  if (!isClaimed) return;
  await sendDailyLimitWarningEmail({
    to: email,
    name: owner.name,
    chatbotName: crossing.scope === "chatbot" ? chatbot.name : null,
    count: crossing.count,
    limit: crossing.limit,
    threshold: crossing.threshold,
  });
}

/**
 * Email the chatbot's owner for every limit this message brought to its warning share or
 * 100%. Never throws: each failure is logged, and the chat goes on.
 */
export async function sendLimitWarnings(
  chatbot: WarnedChatbot,
  owner: WarnedOwner,
  crossings: LimitCrossing[],
  date: string,
): Promise<void> {
  for (const crossing of crossings) {
    try {
      await sendOneWarning(chatbot, owner, crossing, date);
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
  chatbot: WarnedChatbot,
  owner: WarnedOwner | undefined,
  limits: { chatbot: number; owner: number },
  result: DailyMessageResult,
): void {
  if (!owner || !result.isAllowed || !result.counts) return;
  const crossings = findLimitCrossings(result.counts, limits);
  if (crossings.length === 0) return;
  void sendLimitWarnings(chatbot, owner, crossings, result.date);
}
