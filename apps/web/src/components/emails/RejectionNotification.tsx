import * as React from "react";
import { EmailLayout } from "./email-layout";
import { text, list, link, signature, footer } from "./email-styles";

interface RejectionNotificationProps {
  userName: string;
  supportEmail: string;
}

export function RejectionNotification({
  userName,
  supportEmail,
}: RejectionNotificationProps) {
  return (
    <EmailLayout>
      <p style={text}>Hi {userName},</p>

      <p style={text}>
        Thank you for your interest in Teach Anything®. Unfortunately, we are
        unable to approve your account registration at this time.
      </p>

      <p style={text}>Why might this happen?</p>
      <ul style={list}>
        <li>
          Registration may be limited to specific educational institutions
        </li>
        <li>Your email domain may not be on our approved list</li>
        <li>Additional verification may be required</li>
      </ul>

      <p style={text}>
        If you believe this decision was made in error or if you have questions,
        please contact us at{" "}
        <a href={`mailto:${supportEmail}`} style={link}>
          {supportEmail}
        </a>
        .
      </p>

      <p style={text}>We appreciate your understanding.</p>

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

export default RejectionNotification;
