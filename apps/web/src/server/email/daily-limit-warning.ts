import { env } from "@/lib/env";
import { DailyLimitWarning } from "@/components/emails/DailyLimitWarning";
import {
  dailyLimitWarningCopy,
  type LimitWarningFacts,
} from "@/lib/daily-limit-warning-copy";
import { queueEmail } from "./delivery";
import { getAdminContactEmail } from "./support-email";

export type DailyLimitWarningParams = LimitWarningFacts & {
  to: string;
  /** The professor's name; null when their account has none. */
  name: string | null;
};

/** Tell a professor one of their daily message limits is nearly or fully used. */
export async function sendDailyLimitWarningEmail(
  params: DailyLimitWarningParams,
) {
  const appUrl = env.NEXT_PUBLIC_APP_URL;
  return queueEmail({
    emailType: "daily_limit_warning",
    to: params.to,
    subject: dailyLimitWarningCopy(params).subject,
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
