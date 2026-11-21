import * as React from "react";
import { EmailLayout } from "./email-layout";
import { text, link, signature, footer, list } from "./email-styles";

interface IncorrectInfoProps {
  userName: string;
  supportEmail: string;
}

export function IncorrectInfo({ userName, supportEmail }: IncorrectInfoProps) {
  return (
    <EmailLayout>
      <p style={text}>Hi {userName},</p>

      <p style={text}>
        Thank you for registering with Teach Anything®. Some of the details in
        your registration look incorrect or incomplete, so we are not able to
        approve your account yet.
      </p>

      <p style={text}>
        Please reply to this email with corrected versions of the following:
      </p>

      <ul style={list}>
        <li>Your institutional affiliation</li>
        <li>Your department</li>
        <li>A faculty or academic webpage that lists you</li>
      </ul>

      <p style={text}>
        Once we have the corrected details, we will review your registration
        again.
      </p>

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

export default IncorrectInfo;
