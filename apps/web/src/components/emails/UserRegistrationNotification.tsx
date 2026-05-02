import * as React from "react";

interface UserRegistrationNotificationProps {
  userName: string;
  userEmail: string;
  registrationDate: string;
  adminUrl: string;
  supportEmail: string;
}

export function UserRegistrationNotification({
  userName,
  userEmail,
  registrationDate,
  adminUrl,
  supportEmail,
}: UserRegistrationNotificationProps) {
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
              <p style={text}>Hi,</p>

              <p style={text}>
                A new user has registered and is awaiting approval:
              </p>

              <p style={text}>
                <strong>Name:</strong> {userName}
                <br />
                <strong>Email:</strong> {userEmail}
                <br />
                <strong>Registration Date:</strong> {registrationDate}
              </p>

              <p style={text}>
                Please review and approve or reject this registration request.
              </p>

              <p style={text}>
                You can access the admin dashboard here:{" "}
                <a href={adminUrl} style={link}>
                  {adminUrl}
                </a>
              </p>

              <p style={signature}>
                Best regards,
                <br />
                Teach Anything™
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

export default UserRegistrationNotification;

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
