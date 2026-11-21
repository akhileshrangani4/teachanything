import * as React from "react";
import { EmailLayout } from "./email-layout";
import { text, list, link, signature, footer } from "./email-styles";

interface AccountDisabledProps {
  userName: string;
  supportEmail: string;
}

export function AccountDisabled({
  userName,
  supportEmail,
}: AccountDisabledProps) {
  return (
    <EmailLayout>
      <p style={text}>Hi {userName},</p>

      <p style={text}>
        I&apos;m writing to inform you that your Teach Anything® account has
        been temporarily disabled by an administrator. You will not be able to
        log in until your account is re-enabled.
      </p>

      <p style={text}>What this means:</p>
      <ul style={list}>
        <li>You cannot log in to your account</li>
        <li>Your chatbots are temporarily inaccessible</li>
        <li>Your data remains safe and secure</li>
        <li>You can contact support to resolve this</li>
      </ul>

      <p style={text}>
        If you have questions about why your account was disabled or need
        assistance, please contact our support team at{" "}
        <a href={`mailto:${supportEmail}`} style={link}>
          {supportEmail}
        </a>
        .
      </p>

      <p style={text}>
        We&apos;re here to help resolve any issues and get you back to using
        Teach Anything® as soon as possible.
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

export default AccountDisabled;
