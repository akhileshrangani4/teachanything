import { render } from "@react-email/render";
import { env, getAdminEmails, isServiceAvailable } from "./env";
import { logInfo, logError } from "./logger";
import { publishEmailJob } from "./qstash";
import { UserRegistrationNotification } from "@/components/emails/UserRegistrationNotification";
import { ApprovalConfirmation } from "@/components/emails/ApprovalConfirmation";
import { RejectionNotification } from "@/components/emails/RejectionNotification";
import { PromoteToAdmin } from "@/components/emails/PromoteToAdmin";
import { DemoteFromAdmin } from "@/components/emails/DemoteFromAdmin";
import { AccountDisabled } from "@/components/emails/AccountDisabled";
import { AccountEnabled } from "@/components/emails/AccountEnabled";
import { AccountDeleted } from "@/components/emails/AccountDeleted";
import { PasswordReset } from "@/components/emails/PasswordReset";
import { db } from "@teachanything/db";
import {
  user,
  emailDeliveries,
  type emailTypeEnum,
} from "@teachanything/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// Support email - computed once at module load
const supportEmail =
  env.NEXT_PUBLIC_CONTACT_EMAIL ||
  getAdminEmails()[0] ||
  "no admin email found";

type EmailType = (typeof emailTypeEnum.enumValues)[number];

/**
 * Queue an email for delivery via QStash.
 * Creates a delivery tracking record and publishes the job.
 *
 * When QStash is not configured (local dev), logs the email to console
 * and marks delivery as "sent" so downstream code (auth hooks) succeeds.
 */
async function queueEmail(params: {
  emailType: EmailType;
  to: string | string[];
  subject: string;
  reactComponent: React.ReactElement;
  replyTo?: string;
}): Promise<{ deliveryId: string }> {
  const idempotencyKey = randomUUID();
  const html = await render(params.reactComponent);
  const recipientEmail = Array.isArray(params.to)
    ? params.to.join(", ")
    : params.to;
  const fromEmail = env.RESEND_FROM_EMAIL || "dev@localhost";

  // Create delivery tracking record
  const rows = await db
    .insert(emailDeliveries)
    .values({
      emailType: params.emailType,
      recipientEmail,
      subject: params.subject,
      idempotencyKey,
      deliveryStatus: "queued",
    })
    .returning({ id: emailDeliveries.id });

  const deliveryId = rows[0]!.id;

  // When QStash is not configured, log email and mark as sent
  if (!isServiceAvailable("qstash")) {
    console.warn(
      `[dev] Email (${params.emailType}) → ${recipientEmail}: "${params.subject}"`,
    );

    await db
      .update(emailDeliveries)
      .set({ deliveryStatus: "sent", updatedAt: new Date() })
      .where(eq(emailDeliveries.id, deliveryId));

    return { deliveryId };
  }

  // Publish to QStash
  try {
    const { messageId } = await publishEmailJob({
      body: {
        deliveryId,
        idempotencyKey,
        from: `Teach anything. <${fromEmail}>`,
        to: params.to,
        subject: params.subject,
        html,
        ...(params.replyTo && { replyTo: params.replyTo }),
      },
    });

    // Store QStash message ID for correlation
    await db
      .update(emailDeliveries)
      .set({ qstashMessageId: messageId, updatedAt: new Date() })
      .where(eq(emailDeliveries.id, deliveryId));

    logInfo("Email queued for delivery", {
      deliveryId,
      emailType: params.emailType,
      recipientEmail,
      qstashMessageId: messageId,
    });

    return { deliveryId };
  } catch (error) {
    // Mark delivery as failed so it doesn't stay stuck in "queued"
    await db
      .update(emailDeliveries)
      .set({
        deliveryStatus: "failed",
        errorMessage:
          error instanceof Error
            ? error.message
            : "Failed to publish to QStash",
        updatedAt: new Date(),
      })
      .where(eq(emailDeliveries.id, deliveryId));

    throw error;
  }
}

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
