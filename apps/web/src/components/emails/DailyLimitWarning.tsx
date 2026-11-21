import * as React from "react";
import { EmailLayout } from "./email-layout";
import { text, link, signature, footer } from "./email-styles";
import {
  dailyLimitWarningCopy,
  type LimitWarningFacts,
} from "@/lib/daily-limit-warning-copy";

interface DailyLimitWarningProps extends LimitWarningFacts {
  userName: string | null;
  dashboardUrl: string;
  helpUrl: string;
  supportEmail: string;
}

export function DailyLimitWarning(props: DailyLimitWarningProps) {
  const { userName, dashboardUrl, helpUrl, supportEmail } = props;
  const copy = dailyLimitWarningCopy(props);
  const supportHref = `mailto:${supportEmail}`;

  return (
    <EmailLayout>
      <p style={text}>{userName ? `Hello ${userName},` : "Hello,"}</p>

      <p style={text}>{copy.usage}</p>

      <p style={text}>{copy.next}</p>

      <p style={text}>
        {"If you are expecting a large class session, please write to us at "}
        <a href={supportHref} style={link}>
          {supportEmail}
        </a>
        {" and we can look at raising the limit for you."}
      </p>

      <p style={text}>
        {"You can see today's usage on your dashboard: "}
        <a href={dashboardUrl} style={link}>
          {dashboardUrl}
        </a>
      </p>

      <p style={text}>
        {"How daily limits work: "}
        <a href={helpUrl} style={link}>
          {helpUrl}
        </a>
      </p>

      <p style={signature}>
        Best regards,
        <br />
        Teach Anything® Team
      </p>

      <p style={footer}>
        This is an automated message, sent at most once a day for each limit.
        For questions or support, contact us at{" "}
        <a href={supportHref} style={link}>
          {supportEmail}
        </a>
        .
      </p>
    </EmailLayout>
  );
}

export default DailyLimitWarning;
