import * as React from "react";
import { EmailLayout } from "./email-layout";
import { text, link, signature, footer, list } from "./email-styles";
import type { RegistrationEmailBody as Body } from "@/lib/registration-email-templates";

interface RegistrationEmailBodyProps {
  userName: string;
  supportEmail: string;
  body: Body;
}

/** Shared layout of the two ready-made registration emails. */
export function RegistrationEmailBody({
  userName,
  supportEmail,
  body,
}: RegistrationEmailBodyProps) {
  return (
    <EmailLayout>
      <p style={text}>Hi {userName},</p>
      <p style={text}>{body.intro}</p>
      <p style={text}>{body.request}</p>
      <ul style={list}>
        {body.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p style={text}>{body.closing}</p>
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
