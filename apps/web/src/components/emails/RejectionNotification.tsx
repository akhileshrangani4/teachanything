import * as React from "react";

interface RejectionNotificationProps {
  userName: string;
  supportEmail: string;
}

export function RejectionNotification({
  userName,
  supportEmail,
}: RejectionNotificationProps) {
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
                Thank you for your interest in Teach Anything®. Unfortunately,
                we are unable to approve your account registration at this time.
              </p>

              <p style={text}>Why might this happen?</p>
              <ul style={list}>
                <li>
                  Registration may be limited to specific educational
                  institutions
                </li>
                <li>Your email domain may not be on our approved list</li>
                <li>Additional verification may be required</li>
              </ul>

              <p style={text}>
                If you believe this decision was made in error or if you have
                questions, please contact us at{" "}
                <a href={`mailto:${supportEmail}`} style={link}>
                  {supportEmail}
                </a>
                .
              </p>

              <p style={text}>We appreciate your understanding.</p>

              <p style={signature}>
                Best regards,
                <br />
                Teach Anything® Team
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

export default RejectionNotification;

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
