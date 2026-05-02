import * as React from "react";

interface AccountDeletedProps {
  userName: string;
  supportEmail: string;
}

export function AccountDeleted({
  userName,
  supportEmail,
}: AccountDeletedProps) {
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
                This email confirms that your Teach Anything™ account has been
                permanently deleted as requested by an administrator.
              </p>

              <p style={text}>The following has been deleted:</p>
              <ul style={list}>
                <li>Your user account and authentication data</li>
                <li>All chatbots created by you</li>
                <li>All uploaded files and embeddings</li>
                <li>All conversations and messages</li>
                <li>All analytics data</li>
              </ul>

              <p style={text}>
                <strong>Important:</strong> This action cannot be undone. If you
                believe this deletion was made in error, please contact us
                immediately at{" "}
                <a href={`mailto:${supportEmail}`} style={link}>
                  {supportEmail}
                </a>
                .
              </p>

              <p style={text}>
                If you wish to use Teach Anything™ again in the future, you will
                need to register a new account.
              </p>

              <p style={text}>
                We&apos;re sorry to see you go. Thank you for being part of the
                Teach Anything™ community.
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

export default AccountDeleted;

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
