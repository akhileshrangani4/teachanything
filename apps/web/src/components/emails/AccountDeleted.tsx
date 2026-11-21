import * as React from "react";
import { EmailLayout } from "./email-layout";
import { text, list, link, signature, footer } from "./email-styles";

interface AccountDeletedProps {
  userName: string;
  supportEmail: string;
}

export function AccountDeleted({
  userName,
  supportEmail,
}: AccountDeletedProps) {
  return (
    <EmailLayout>
      <p style={text}>Hi {userName},</p>

      <p style={text}>
        This email confirms that your Teach Anything® account has been
        permanently deleted as requested by an administrator.
      </p>

      <p style={text}>The following has been deleted:</p>
      <ul style={list}>
        <li>Your user account and authentication data</li>
        <li>All chatbots created by you</li>
        <li>All uploaded files and embeddings</li>
        <li>All conversations and messages</li>
        <li>All analytics data</li>
      </ul>

      <p style={text}>
        <strong>Important:</strong> This action cannot be undone. If you believe
        this deletion was made in error, please contact us immediately at{" "}
        <a href={`mailto:${supportEmail}`} style={link}>
          {supportEmail}
        </a>
        .
      </p>

      <p style={text}>
        If you wish to use Teach Anything® again in the future, you will need to
        register a new account.
      </p>

      <p style={text}>
        We&apos;re sorry to see you go. Thank you for being part of the Teach
        Anything® community.
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

export default AccountDeleted;
