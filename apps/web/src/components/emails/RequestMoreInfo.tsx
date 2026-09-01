import * as React from "react";

interface RequestMoreInfoProps {
  userName: string;
  loginUrl: string;
  supportEmail: string;
}

export function RequestMoreInfo({
  userName,
  loginUrl,
  supportEmail,
}: RequestMoreInfoProps) {
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
                Thank you for registering with Teach Anything™. We need a bit
                more information to complete your account approval.
              </p>

              <p style={text}>
                Please review your registration details and make sure your
                institutional affiliation, department, or academic webpage are
                provided and accurate.
              </p>

              <p style={text}>
                You can review your registration here:{" "}
                <a href={loginUrl} style={link}>
                  {loginUrl}
                </a>
              </p>

              <p style={text}>
                If you need assistance, please reply to this email or reach out
                to our support team.
              </p>

              <p style={signature}>
                Best regards,
                <br />
                Teach Anything™ Team
              </p>

              <p style={footer}>
                This is an automated message. Please do not reply directly to
                this email. For questions or support, contact us at{" "}
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

export default RequestMoreInfo;

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
