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
