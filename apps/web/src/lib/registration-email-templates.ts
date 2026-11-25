/**
 * Registration emails an admin can send to a pending user.
 *
 * Client-safe on purpose: the server wrappers and the admin send-email dialog
 * both read the subjects from here, so the subject an admin previews is the
 * subject the user receives.
 */
export const REGISTRATION_EMAIL_TEMPLATE_IDS = [
  "request_more_info",
  "incorrect_info",
  "generic_admin_message",
] as const;

export type RegistrationEmailTemplateId =
  (typeof REGISTRATION_EMAIL_TEMPLATE_IDS)[number];

/**
 * Upper bound on the admin-written text in a generic admin message: room
 * for a long email (about 1,500 words), while still bounding what one
 * request can store in the delivery audit metadata.
 */
export const MAX_CUSTOM_MESSAGE_LENGTH = 10_000;

export const REGISTRATION_EMAIL_TEMPLATES: Record<
  RegistrationEmailTemplateId,
  { label: string; subject: string; summary: string }
> = {
  request_more_info: {
    label: "Request more information",
    subject: "Additional information required for your registration",
    summary:
      "Asks the user to reply with their institutional affiliation, department, and a faculty or academic webpage.",
  },
  incorrect_info: {
    label: "Incorrect registration information",
    subject: "Please review your registration details",
    summary:
      "Tells the user some registration details look incorrect and asks them to reply with corrected ones.",
  },
  generic_admin_message: {
    label: "Custom message",
    subject: "Message about your Teach Anything® registration",
    summary: "Sends the message you write below.",
  },
};

/** The fixed text of a ready-made registration email, after "Hi {name},". */
export interface RegistrationEmailBody {
  intro: string;
  request: string;
  items: readonly string[];
  closing: string;
}

const REQUESTED_DETAILS = [
  "Your institutional affiliation",
  "Your department",
  "A faculty or academic webpage that lists you",
] as const;

/**
 * Body text of the two ready-made emails. The email components render it and
 * the admin dialog previews it, so the preview is the email the user gets.
 */
export const REGISTRATION_EMAIL_BODIES: Record<
  Exclude<RegistrationEmailTemplateId, "generic_admin_message">,
  RegistrationEmailBody
> = {
  request_more_info: {
    intro:
      "Thank you for registering with Teach Anything®. Before we can approve your account, we need a little more information about your teaching role.",
    request: "Please reply to this email with the following:",
    items: REQUESTED_DETAILS,
    closing: "We will review your reply and follow up as soon as we can.",
  },
  incorrect_info: {
    intro:
      "Thank you for registering with Teach Anything®. Some of the details in your registration look incorrect or incomplete, so we are not able to approve your account yet.",
    request:
      "Please reply to this email with corrected versions of the following:",
    items: REQUESTED_DETAILS,
    closing:
      "Once we have the corrected details, we will review your registration again.",
  },
};
