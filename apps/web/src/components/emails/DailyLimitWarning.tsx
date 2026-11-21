import * as React from "react";
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
