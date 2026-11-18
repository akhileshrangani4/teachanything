import * as React from "react";

interface GenericAdminMessageProps {
  userName: string;
  customMessage: string;
  supportEmail: string;
}

export function GenericAdminMessage({
  userName,
  customMessage,
  supportEmail,
}: GenericAdminMessageProps) {
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
              <p style={text}>Hi {userName},</p>

              <p style={customMessageText}>{customMessage}</p>

              <p style={signature}>
                Best regards,
                <br />
                Teach Anything® Team
              </p>

              <p style={footer}>
                Replies to this email reach our support team. You can also
                contact us at{" "}
                <a href={`mailto:${supportEmail}`} style={link}>
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

export default GenericAdminMessage;

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

// Admin-typed text: keep the line breaks and blank lines the admin wrote.
const customMessageText = {
  ...text,
  whiteSpace: "pre-wrap" as const,
};
