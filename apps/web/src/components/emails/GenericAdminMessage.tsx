import * as React from "react";
import { EmailLayout } from "./email-layout";
import { text, link, signature, footer } from "./email-styles";

interface GenericAdminMessageProps {
  userName: string;
  customMessage: string;
  supportEmail: string;
}

export function GenericAdminMessage({
  userName,
  customMessage,
  supportEmail,
}: GenericAdminMessageProps) {
  return (
    <EmailLayout>
      <p style={text}>Hi {userName},</p>

      <p style={customMessageText}>{customMessage}</p>

      <p style={signature}>
        Best regards,
        <br />
        Teach Anything® Team
      </p>

      <p style={footer}>
        Replies to this email reach our support team. You can also contact us at{" "}
        <a href={`mailto:${supportEmail}`} style={link}>
          {supportEmail}
        </a>
        .
      </p>
    </EmailLayout>
  );
}

export default GenericAdminMessage;

// Admin-typed text: keep the line breaks and blank lines the admin wrote.
const customMessageText = {
  ...text,
  whiteSpace: "pre-wrap" as const,
};
