import * as React from "react";
import { EmailLayout } from "./email-layout";
import { text, list, link, signature, footer } from "./email-styles";

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
    <EmailLayout>
      <p style={text}>Hi {userName},</p>

      <p style={text}>
        I wanted to let you know that you&apos;ve been promoted to an
        administrator role on Teach Anything®. You now have full access to
        manage users, chatbots, and system settings.
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
        Please use your admin privileges responsibly. All admin actions are
        logged for security purposes.
      </p>

      <p style={text}>
        Welcome to the Teach Anything® admin team! We trust you&apos;ll help us
        maintain a secure and efficient platform.
      </p>

      <p style={signature}>
        Best regards,
        <br />
        Teach Anything® Admin Team
      </p>

      <p style={footer}>
        This is an automated message. Please do not reply to this email. For
        questions or support, contact us at{" "}
        <a href={`mailto:${supportEmail}`} style={link}>
          {supportEmail}
        </a>
        .
      </p>
    </EmailLayout>
  );
}

export default PromoteToAdmin;
