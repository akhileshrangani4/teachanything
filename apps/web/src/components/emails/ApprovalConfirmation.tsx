import * as React from "react";
import { EmailLayout } from "./email-layout";
import { text, list, link, signature, footer } from "./email-styles";

interface ApprovalConfirmationProps {
  userName: string;
  loginUrl: string;
  supportEmail: string;
}

export function ApprovalConfirmation({
  userName,
  loginUrl,
  supportEmail,
}: ApprovalConfirmationProps) {
  return (
    <EmailLayout>
      <p style={text}>Hi {userName},</p>

      <p style={text}>
        Great news! Your Teach Anything® account has been approved by an
        administrator. You can now log in and start creating AI-powered chatbots
        for your courses.
      </p>

      <p style={text}>What you can do now:</p>
      <ul style={list}>
        <li>Create intelligent chatbots powered by multiple AI models</li>
        <li>Upload course materials (PDFs, Word docs, and more)</li>
        <li>Share chatbots with your students via simple links</li>
        <li>Track conversations and analyze student interactions</li>
      </ul>

      <p style={text}>
        You can log in here:{" "}
        <a href={loginUrl} style={link}>
          {loginUrl}
        </a>
      </p>

      <p style={text}>
        If you have any questions or need assistance, please don&apos;t hesitate
        to reach out.
      </p>

      <p style={text}>
        Welcome to Teach Anything®! We&apos;re excited to have you on board.
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

export default ApprovalConfirmation;
