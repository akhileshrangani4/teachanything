import * as React from "react";

interface ApprovalConfirmationProps {
  userName: string;
  loginUrl: string;
  supportEmail: string;
}

export function ApprovalConfirmation({
  userName,
  loginUrl,
  supportEmail,
}: ApprovalConfirmationProps) {
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
                Great news! Your Teach Anything™ account has been approved by an
                administrator. You can now log in and start creating AI-powered
                chatbots for your courses.
              </p>

              <p style={text}>What you can do now:</p>
              <ul style={list}>
                <li>
                  Create intelligent chatbots powered by multiple AI models
                </li>
                <li>Upload course materials (PDFs, Word docs, and more)</li>
                <li>Share chatbots with your students via simple links</li>
                <li>Track conversations and analyze student interactions</li>
              </ul>

              <p style={text}>
                You can log in here:{" "}
                <a href={loginUrl} style={link}>
                  {loginUrl}
                </a>
              </p>

              <p style={text}>
                If you have any questions or need assistance, please don&apos;t
                hesitate to reach out.
              </p>

              <p style={text}>
                Welcome to Teach Anything™! We&apos;re excited to have you on
                board.
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

export default ApprovalConfirmation;

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
