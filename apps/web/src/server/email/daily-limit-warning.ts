import { env } from "@/lib/env";
import { DailyLimitWarning } from "@/components/emails/DailyLimitWarning";
import { queueEmail } from "./delivery";
import { getAdminContactEmail } from "./support-email";

/** Share of a daily limit, in percent, at which the owner is emailed. */
export type LimitWarningThreshold = 80 | 100;

export type DailyLimitWarningParams = {
  to: string;
  /** The professor's name; null when their account has none. */
  name: string | null;
  /** The chatbot whose own limit this is; null for the professor's total. */
  chatbotName: string | null;
  count: number;
  limit: number;
  threshold: LimitWarningThreshold;
};

/** The email's subject line, naming the chatbot for a chatbot limit. */
export function dailyLimitWarningSubject(
  params: Pick<DailyLimitWarningParams, "chatbotName" | "threshold">,
): string {
  const { chatbotName, threshold } = params;
  if (chatbotName === null) {
    return threshold === 100
      ? "Your chatbots have reached today's message limit"
      : "Heads-up: your chatbots have used 80% of today's messages";
  }
  return threshold === 100
    ? `"${chatbotName}" has reached today's message limit`
    : `Heads-up: "${chatbotName}" has used 80% of today's messages`;
}

/** Tell a professor one of their daily message limits is nearly or fully used. */
export async function sendDailyLimitWarningEmail(
  params: DailyLimitWarningParams,
) {
  const appUrl = env.NEXT_PUBLIC_APP_URL;
  return queueEmail({
    emailType: "daily_limit_warning",
    to: params.to,
    subject: dailyLimitWarningSubject(params),
    reactComponent: DailyLimitWarning({
      userName: params.name,
      chatbotName: params.chatbotName,
      count: params.count,
      limit: params.limit,
      threshold: params.threshold,
      dashboardUrl: `${appUrl}/dashboard`,
      helpUrl: `${appUrl}/docs/instructors/daily-message-limits`,
      supportEmail: getAdminContactEmail(),
    }),
  });
}
