import { RequestMoreInfo } from "@/components/emails/RequestMoreInfo";
import { IncorrectInfo } from "@/components/emails/IncorrectInfo";
import { GenericAdminMessage } from "@/components/emails/GenericAdminMessage";
import { REGISTRATION_EMAIL_TEMPLATES } from "@/lib/registration-email-templates";
import { queueEmail } from "./delivery";
import { getAdminContactEmail } from "./support-email";

const supportEmail = getAdminContactEmail();

/**
 * Registration emails an admin sends to a pending user from the admin
 * dashboard. Each records the sending admin (and, for a custom message, its
 * text) on the delivery row, since it goes out under the platform's name.
 */

/**
 * Ask a pending user for the details needed to approve them. Replies go to
 * support, so the email invites a reply instead of a login (pending users
 * cannot sign in).
 */
export async function sendRequestMoreInfoEmail(params: {
  email: string;
  name: string;
  sentByAdminId: string;
}) {
  return queueEmail({
    emailType: "request_more_info",
    to: params.email,
    subject: REGISTRATION_EMAIL_TEMPLATES.request_more_info.subject,
    reactComponent: RequestMoreInfo({ userName: params.name, supportEmail }),
    replyTo: supportEmail,
    metadata: {
      sentByAdminId: params.sentByAdminId,
      templateId: "request_more_info",
    },
  });
}

/**
 * Tell a pending user their registration details look wrong and ask them to
 * reply with corrected ones.
 */
export async function sendIncorrectInfoEmail(params: {
  email: string;
  name: string;
  sentByAdminId: string;
}) {
  return queueEmail({
    emailType: "incorrect_info",
    to: params.email,
    subject: REGISTRATION_EMAIL_TEMPLATES.incorrect_info.subject,
    reactComponent: IncorrectInfo({ userName: params.name, supportEmail }),
    replyTo: supportEmail,
    metadata: {
      sentByAdminId: params.sentByAdminId,
      templateId: "incorrect_info",
    },
  });
}

/**
 * Send a pending user a message written by an admin. The text is stored on
 * the delivery row with the sender, since it goes out under the platform's
 * name.
 */
export async function sendGenericAdminEmail(params: {
  email: string;
  name: string;
  customMessage: string;
  sentByAdminId: string;
}) {
  return queueEmail({
    emailType: "generic_admin_message",
    to: params.email,
    subject: REGISTRATION_EMAIL_TEMPLATES.generic_admin_message.subject,
    reactComponent: GenericAdminMessage({
      userName: params.name,
      customMessage: params.customMessage,
      supportEmail,
    }),
    replyTo: supportEmail,
    metadata: {
      sentByAdminId: params.sentByAdminId,
      templateId: "generic_admin_message",
      customMessage: params.customMessage,
    },
  });
}
