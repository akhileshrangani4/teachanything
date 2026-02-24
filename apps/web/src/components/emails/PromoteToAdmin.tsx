import * as React from "react";

interface PromoteToAdminProps {
  userName: string;
  loginUrl: string;
  supportEmail: string;
}

export function PromoteToAdmin({
  userName,
  loginUrl,
  supportEmail,
}: PromoteToAdminProps) {
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
                I wanted to let you know that you&apos;ve been promoted to an
                administrator role on Teach anything. You now have full access
                to manage users, chatbots, and system settings.
              </p>

              <p style={text}>Your new admin capabilities include:</p>
              <ul style={list}>
                <li>Approve or reject user registrations</li>
                <li>Manage user roles and permissions</li>
                <li>Enable or disable user accounts</li>
                <li>View and manage all chatbots</li>
                <li>Configure system settings</li>
              </ul>

              <p style={text}>
                You can access the admin dashboard here:{" "}
                <a href={loginUrl} style={link}>
                  {loginUrl}
                </a>
              </p>

              <p style={text}>
                Please use your admin privileges responsibly. All admin actions
                are logged for security purposes.
              </p>

              <p style={text}>
                Welcome to the Teach anything admin team! We trust you&apos;ll
                help us maintain a secure and efficient platform.
              </p>

              <p style={signature}>
                Best regards,
                <br />
                Teach anything Admin Team
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

export default PromoteToAdmin;

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
