import * as React from "react";
import { EmailLayout } from "./email-layout";
import { text, link, signature, footer } from "./email-styles";

interface UserRegistrationNotificationProps {
  userName: string;
  userEmail: string;
  registrationDate: string;
  adminUrl: string;
  supportEmail: string;
}

export function UserRegistrationNotification({
  userName,
  userEmail,
  registrationDate,
  adminUrl,
  supportEmail,
}: UserRegistrationNotificationProps) {
  return (
    <EmailLayout>
      <p style={text}>Hi,</p>

      <p style={text}>A new user has registered and is awaiting approval:</p>

      <p style={text}>
        <strong>Name:</strong> {userName}
        <br />
        <strong>Email:</strong> {userEmail}
        <br />
        <strong>Registration Date:</strong> {registrationDate}
      </p>

      <p style={text}>
        Please review and approve or reject this registration request.
      </p>

      <p style={text}>
        You can access the admin dashboard here:{" "}
        <a href={adminUrl} style={link}>
          {adminUrl}
        </a>
      </p>

      <p style={signature}>
        Best regards,
        <br />
        Teach Anything®
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

export default UserRegistrationNotification;
