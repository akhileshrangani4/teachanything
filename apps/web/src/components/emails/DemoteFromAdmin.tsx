import * as React from "react";
import { EmailLayout } from "./email-layout";
import { text, list, link, signature, footer } from "./email-styles";

interface DemoteFromAdminProps {
  userName: string;
  loginUrl: string;
  supportEmail: string;
}

export function DemoteFromAdmin({
  userName,
  loginUrl,
  supportEmail,
}: DemoteFromAdminProps) {
  return (
    <EmailLayout>
      <p style={text}>Hi {userName},</p>

      <p style={text}>
        I&apos;m writing to inform you that your administrator privileges have
        been removed from your Teach Anything® account. Your account has been
        converted to a regular user account.
      </p>

      <p style={text}>What this means:</p>
      <ul style={list}>
        <li>You can still access your account and chatbots</li>
        <li>You retain all your existing chatbots and data</li>
        <li>You no longer have access to admin features</li>
        <li>You cannot manage users or system settings</li>
      </ul>

      <p style={text}>
        You can still log in to your account here:{" "}
        <a href={loginUrl} style={link}>
          {loginUrl}
        </a>
      </p>

      <p style={text}>
        If you believe this change was made in error or have any questions,
        please contact us at{" "}
        <a href={`mailto:${supportEmail}`} style={link}>
          {supportEmail}
        </a>
        .
      </p>

      <p style={text}>Thank you for your understanding.</p>

      <p style={signature}>
        Best regards,
        <br />
        Teach Anything® Team
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

export default DemoteFromAdmin;
