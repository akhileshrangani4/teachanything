import * as React from "react";

interface DailyLimitWarningProps {
  userName: string | null;
  /** The chatbot whose own limit this is; null for the professor's total. */
  chatbotName: string | null;
  count: number;
  limit: number;
  threshold: 80 | 100;
  dashboardUrl: string;
  helpUrl: string;
  supportEmail: string;
}

/**
 * The email's two key sentences: what was used, and what happens next. Each
 * is one string, so it renders as a single text node.
 */
export function dailyLimitWarningCopy({
  chatbotName,
  count,
  limit,
  threshold,
}: Pick<
  DailyLimitWarningProps,
  "chatbotName" | "count" | "limit" | "threshold"
>): { usage: string; next: string } {
  const subject =
    chatbotName === null
      ? "All of your chatbots together have"
      : `Your chatbot "${chatbotName}" has`;
  const whose = chatbotName === null ? "your" : "its";
  if (threshold === 100) {
    return {
      usage: `${subject} reached ${whose} daily limit of ${limit} student messages.`,
      next: "Students will see the daily-limit message until midnight US Eastern time, when the count resets.",
    };
  }
  return {
    usage: `${subject} received ${count} of ${whose} ${limit} daily student messages today, 80% of the limit.`,
    next: "The count resets at midnight US Eastern time.",
  };
}

export function DailyLimitWarning(props: DailyLimitWarningProps) {
  const { userName, dashboardUrl, helpUrl, supportEmail } = props;
  const copy = dailyLimitWarningCopy(props);
  const supportHref = `mailto:${supportEmail}`;

  return (
    <html>
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style={body}>
        <table
          role="presentation"
          style={wrapper}
          cellPadding="0"
          cellSpacing="0"
          border={0}
        >
          <tr>
            <td style={cell}>
              <p style={text}>{userName ? `Hello ${userName},` : "Hello,"}</p>

              <p style={text}>{copy.usage}</p>

              <p style={text}>{copy.next}</p>

              <p style={text}>
                {
                  "If you are expecting a large class session, please write to us at "
                }
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
                This is an automated message, sent at most once a day for each
                limit. For questions or support, contact us at{" "}
                <a href={supportHref} style={link}>
                  {supportEmail}
                </a>
                .
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  );
}

export default DailyLimitWarning;

const body = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#333333",
  backgroundColor: "#ffffff",
  margin: 0,
  padding: "20px",
};

const wrapper = {
  maxWidth: "600px",
  margin: "0 auto",
};

const cell = {
  padding: "20px 0",
};

const text = {
  margin: "0 0 16px",
  color: "#333333",
  fontSize: "16px",
  lineHeight: "1.6",
};

const link = {
  color: "#0066cc",
  textDecoration: "underline",
};

const signature = {
  margin: "24px 0 0",
  color: "#333333",
  fontSize: "16px",
  lineHeight: "1.6",
};

const footer = {
  margin: "24px 0 0",
  padding: "16px 0 0",
  borderTop: "1px solid #e9ecef",
  color: "#666666",
  fontSize: "12px",
  lineHeight: "1.5",
};
