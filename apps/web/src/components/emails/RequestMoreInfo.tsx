import * as React from "react";
import { EmailLayout } from "./email-layout";
import { text, link, signature, footer, list } from "./email-styles";

interface RequestMoreInfoProps {
  userName: string;
  supportEmail: string;
}

export function RequestMoreInfo({
  userName,
  supportEmail,
}: RequestMoreInfoProps) {
  return (
    <EmailLayout>
      <p style={text}>Hi {userName},</p>

      <p style={text}>
        Thank you for registering with Teach Anything®. Before we can approve
        your account, we need a little more information about your teaching
        role.
      </p>

      <p style={text}>Please reply to this email with the following:</p>

      <ul style={list}>
        <li>Your institutional affiliation</li>
        <li>Your department</li>
        <li>A faculty or academic webpage that lists you</li>
      </ul>

      <p style={text}>
        We will review your reply and follow up as soon as we can.
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

export default RequestMoreInfo;
