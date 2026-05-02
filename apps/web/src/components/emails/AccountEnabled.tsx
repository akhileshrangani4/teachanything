import * as React from "react";

interface AccountEnabledProps {
  userName: string;
  loginUrl: string;
  supportEmail: string;
}

export function AccountEnabled({
  userName,
  loginUrl,
  supportEmail,
}: AccountEnabledProps) {
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

              <p style={text}>
                Great news! Your Teach Anything™ account has been re-enabled and
                you can now log in again. All your chatbots and data are ready
                for you to access.
              </p>

              <p style={text}>You can now:</p>
              <ul style={list}>
                <li>Log in to your account</li>
                <li>Access all your chatbots</li>
                <li>Continue creating and managing chatbots</li>
                <li>Use all platform features</li>
              </ul>

              <p style={text}>
                You can log in here:{" "}
                <a href={loginUrl} style={link}>
                  {loginUrl}
                </a>
              </p>

              <p style={text}>
                Welcome back! If you have any questions or need assistance,
                please don&apos;t hesitate to reach out.
              </p>

              <p style={signature}>
                Best regards,
                <br />
                Teach Anything™ Team
              </p>

              <p style={footer}>
                This is an automated message. Please do not reply to this email.
                For questions or support, contact us at{" "}
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

export default AccountEnabled;

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

const list = {
  margin: "0 0 16px",
  paddingLeft: "24px",
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
