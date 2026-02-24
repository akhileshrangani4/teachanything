import * as React from "react";

interface PasswordResetProps {
  userName: string;
  resetUrl: string;
  supportEmail: string;
}

export function PasswordReset({
  userName,
  resetUrl,
  supportEmail,
}: PasswordResetProps) {
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
                We received a request to reset the password for your Teach
                anything account. If you made this request, click the button
                below to set a new password:
              </p>

              <table
                role="presentation"
                cellPadding="0"
                cellSpacing="0"
                border={0}
                style={{ margin: "24px 0" }}
              >
                <tr>
                  <td>
                    <a href={resetUrl} style={button}>
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style={text}>Or copy and paste this link into your browser:</p>
              <p style={linkText}>
                <a href={resetUrl} style={link}>
                  {resetUrl}
                </a>
              </p>

              <p style={text}>
                This link will expire in 1 hour for security reasons.
              </p>

              <p style={warningText}>
                If you didn&apos;t request a password reset, you can safely
                ignore this email. Your password will not be changed.
              </p>

              <p style={signature}>
                Best regards,
                <br />
                Teach anything Team
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

export default PasswordReset;

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

const linkText = {
  margin: "0 0 16px",
  color: "#333333",
  fontSize: "14px",
  lineHeight: "1.6",
  wordBreak: "break-all" as const,
};

const link = {
  color: "#0066cc",
  textDecoration: "underline",
};

const button = {
  display: "inline-block",
  padding: "12px 24px",
  backgroundColor: "#0066cc",
  color: "#ffffff",
  textDecoration: "none",
  borderRadius: "6px",
  fontWeight: "bold" as const,
  fontSize: "16px",
};

const warningText = {
  margin: "24px 0 16px",
  padding: "12px",
  backgroundColor: "#f8f9fa",
  borderLeft: "4px solid #e9ecef",
  color: "#666666",
  fontSize: "14px",
  lineHeight: "1.6",
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
