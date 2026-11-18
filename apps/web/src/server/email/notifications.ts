import { env, getAdminEmails } from "@/lib/env";
import { logInfo, logError } from "@/lib/logger";
import { db } from "@teachanything/db";
import { user } from "@teachanything/db/schema";
import { eq } from "drizzle-orm";
import { UserRegistrationNotification } from "@/components/emails/UserRegistrationNotification";
import { ApprovalConfirmation } from "@/components/emails/ApprovalConfirmation";
import { RejectionNotification } from "@/components/emails/RejectionNotification";
import { PromoteToAdmin } from "@/components/emails/PromoteToAdmin";
import { DemoteFromAdmin } from "@/components/emails/DemoteFromAdmin";
import { AccountDisabled } from "@/components/emails/AccountDisabled";
import { AccountEnabled } from "@/components/emails/AccountEnabled";
import { AccountDeleted } from "@/components/emails/AccountDeleted";
import { PasswordReset } from "@/components/emails/PasswordReset";
import { RequestMoreInfo } from "@/components/emails/RequestMoreInfo";
import { IncorrectInfo } from "@/components/emails/IncorrectInfo";
import { GenericAdminMessage } from "@/components/emails/GenericAdminMessage";
import { REGISTRATION_EMAIL_TEMPLATES } from "@/lib/registration-email-templates";
import { queueEmail } from "./delivery";

// Support email - computed once at module load
const supportEmail =
  env.NEXT_PUBLIC_CONTACT_EMAIL ||
  getAdminEmails()[0] ||
  "no admin email found";

/**
 * Get admin emails from the database.
 * Falls back to environment variable if no admins found in database (for initial setup).
 */
async function getAdminEmailsFromDatabase(): Promise<string[]> {
  try {
    const adminUsers = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.role, "admin"));

    const adminEmails = adminUsers
      .map((u) => u.email)
      .filter((email): email is string => !!email);

    if (adminEmails.length === 0) {
      logInfo(
        "No admins found in database, falling back to ADMIN_EMAILS env variable",
      );
      return getAdminEmails();
    }

    return adminEmails;
  } catch (error) {
    logError(
      error,
      "Failed to fetch admin emails from database, falling back to env variable",
    );
    return getAdminEmails();
  }
}

/**
 * Send admin notification email when new user registers
 */
export async function sendAdminNotificationEmail(params: {
  userId: string;
  email: string;
  name: string;
}) {
  const adminEmails = await getAdminEmailsFromDatabase();
  const adminUrl = `${env.NEXT_PUBLIC_APP_URL}/admin`;

  return queueEmail({
    emailType: "admin_notification",
    to: adminEmails,
    subject: "New User Registration - Approval Required",
    reactComponent: UserRegistrationNotification({
      userName: params.name,
      userEmail: params.email,
      registrationDate: new Date().toLocaleString(),
      adminUrl,
      supportEmail,
    }),
  });
}

/**
 * Send approval confirmation email to user
 */
export async function sendApprovalEmail(params: {
  email: string;
  name: string;
}) {
  const loginUrl = `${env.NEXT_PUBLIC_APP_URL}/login`;

  return queueEmail({
    emailType: "approval",
    to: params.email,
    subject: "Your Account Has Been Approved",
    reactComponent: ApprovalConfirmation({
      userName: params.name,
      loginUrl,
      supportEmail,
    }),
  });
}

/**
 * Send rejection notification email to user
 */
export async function sendRejectionEmail(params: {
  email: string;
  name: string;
}) {
  return queueEmail({
    emailType: "rejection",
    to: params.email,
    subject: "Account Registration Update",
    reactComponent: RejectionNotification({
      userName: params.name,
      supportEmail,
    }),
  });
}

/**
 * Send promotion to admin notification email to user
 */
export async function sendPromoteToAdminEmail(params: {
  email: string;
  name: string;
}) {
  const loginUrl = `${env.NEXT_PUBLIC_APP_URL}/admin`;

  return queueEmail({
    emailType: "promote_admin",
    to: params.email,
    subject: "Admin Privileges Granted!",
    reactComponent: PromoteToAdmin({
      userName: params.name,
      loginUrl,
      supportEmail,
    }),
  });
}

/**
 * Send demotion from admin notification email to user
 */
export async function sendDemoteFromAdminEmail(params: {
  email: string;
  name: string;
}) {
  const loginUrl = `${env.NEXT_PUBLIC_APP_URL}/login`;

  return queueEmail({
    emailType: "demote_admin",
    to: params.email,
    subject: "Account Role Update",
    reactComponent: DemoteFromAdmin({
      userName: params.name,
      loginUrl,
      supportEmail,
    }),
  });
}

/**
 * Send account disabled notification email to user
 */
export async function sendAccountDisabledEmail(params: {
  email: string;
  name: string;
}) {
  return queueEmail({
    emailType: "account_disabled",
    to: params.email,
    subject: "Account Access Suspended",
    reactComponent: AccountDisabled({
      userName: params.name,
      supportEmail,
    }),
  });
}

/**
 * Send account enabled notification email to user
 */
export async function sendAccountEnabledEmail(params: {
  email: string;
  name: string;
}) {
  const loginUrl = `${env.NEXT_PUBLIC_APP_URL}/login`;

  return queueEmail({
    emailType: "account_enabled",
    to: params.email,
    subject: "Account Re-enabled!",
    reactComponent: AccountEnabled({
      userName: params.name,
      loginUrl,
      supportEmail,
    }),
  });
}

/**
 * Send account deleted notification email to user.
 * Payload is fully self-contained (pre-rendered HTML) so it works
 * even if the user is deleted from the DB before QStash delivers.
 */
export async function sendAccountDeletedEmail(params: {
  email: string;
  name: string;
}) {
  return queueEmail({
    emailType: "account_deleted",
    to: params.email,
    subject: "Account Deletion Confirmation",
    reactComponent: AccountDeleted({
      userName: params.name,
      supportEmail,
    }),
  });
}

/**
 * Send password reset email to user.
 *
 * Called with `void` in auth.ts to prevent timing attacks.
 * Errors are caught and logged but not re-thrown, since thrown
 * errors would become unhandled promise rejections.
 */
export async function sendPasswordResetEmail(params: {
  email: string;
  name: string;
  resetUrl: string;
}) {
  try {
    return await queueEmail({
      emailType: "password_reset",
      to: params.email,
      subject: "Reset Your Password",
      reactComponent: PasswordReset({
        userName: params.name,
        resetUrl: params.resetUrl,
        supportEmail,
      }),
    });
  } catch (error) {
    // Log the error but don't re-throw — this function is called with void (not awaited)
    // in auth.ts to prevent timing attacks, so thrown errors would be unhandled rejections
    logError(error, "Failed to queue password reset email", {
      email: params.email,
    });
  }
}

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
