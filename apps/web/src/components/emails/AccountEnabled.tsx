import * as React from "react";
import { EmailLayout } from "./email-layout";
import { text, list, link, signature, footer } from "./email-styles";

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
    <EmailLayout>
      <p style={text}>Hi {userName},</p>

      <p style={text}>
        Great news! Your Teach Anything® account has been re-enabled and you can
        now log in again. All your chatbots and data are ready for you to
        access.
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
        Welcome back! If you have any questions or need assistance, please
        don&apos;t hesitate to reach out.
      </p>

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

export default AccountEnabled;
