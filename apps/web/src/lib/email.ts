import { render } from "@react-email/render";
import { Resend } from "resend";
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
import { NewsletterEmail } from "@/components/emails/NewsletterEmail";
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
        from: `Teach Anything™ <${fromEmail}>`,
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

// =============================================================================
// Newsletter helpers — use Resend Audiences/Contacts/Broadcasts APIs directly
// =============================================================================

export interface NewsletterContact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  unsubscribed: boolean;
}

function getResendClient(): Resend {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(env.RESEND_API_KEY);
}

function requireContactEnv(): { audienceId: string } {
  if (!env.RESEND_AUDIENCE_ID) {
    throw new Error("RESEND_AUDIENCE_ID is not configured");
  }
  return { audienceId: env.RESEND_AUDIENCE_ID };
}

function requireBroadcastEnv(): { segmentId: string; fromEmail: string } {
  if (!env.RESEND_FROM_EMAIL) {
    throw new Error("RESEND_FROM_EMAIL is not configured");
  }
  if (!env.RESEND_BROADCAST_SEGMENT_ID) {
    throw new Error("RESEND_BROADCAST_SEGMENT_ID is not configured");
  }
  return {
    segmentId: env.RESEND_BROADCAST_SEGMENT_ID,
    fromEmail: env.RESEND_FROM_EMAIL,
  };
}

export async function subscribeToNewsletter(params: {
  email: string;
  firstName?: string;
}): Promise<void> {
  const { audienceId } = requireContactEnv();
  const resend = getResendClient();

  const { error } = await resend.contacts.create({
    audienceId,
    email: params.email,
    firstName: params.firstName,
    unsubscribed: false,
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * List all contacts in the newsletter audience from Resend.
 */
export async function listNewsletterSubscribers(): Promise<
  NewsletterContact[]
> {
  const { audienceId } = requireContactEnv();
  const resend = getResendClient();

  const { data, error } = await resend.contacts.list({ audienceId });

  if (error) {
    throw new Error(error.message);
  }

  return (data?.data ?? []).map((c) => ({
    id: c.id,
    email: c.email,
    firstName: c.first_name ?? null,
    lastName: c.last_name ?? null,
    createdAt: c.created_at,
    unsubscribed: c.unsubscribed,
  }));
}

interface ResendBroadcastRequest {
  segment_id: string;
  from: string;
  subject: string;
  name: string;
  html: string;
  send: true;
}

interface ResendBroadcastSuccess {
  id: string;
}

interface ResendBroadcastError {
  statusCode: number;
  message: string;
  name: string;
}

type ResendBroadcastResponse = ResendBroadcastSuccess | ResendBroadcastError;

/**
 * Create and immediately send a newsletter broadcast via Resend.
 * The rendered HTML includes {{{RESEND_UNSUBSCRIBE_URL}}} and
 * {{{contact.first_name|there}}} which Resend substitutes per-recipient.
 */
export async function sendNewsletterBroadcast(params: {
  subject: string;
  body: string;
}): Promise<{ broadcastId: string }> {
  const { segmentId, fromEmail } = requireBroadcastEnv();

  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  const apiKey = env.RESEND_API_KEY;

  const html = await render(
    NewsletterEmail({
      subject: params.subject,
      body: params.body,
      supportEmail:
        env.NEXT_PUBLIC_CONTACT_EMAIL || getAdminEmails()[0] || fromEmail,
    }),
  );

  // Logged on every failure so the terminal always has context
  const debugCtx = {
    hasApiKey: true,
    hasBroadcastSegmentId: !!env.RESEND_BROADCAST_SEGMENT_ID,
    fromEmail,
    subjectLength: params.subject.length,
    bodyLength: params.body.length,
    htmlLength: html.length,
  };

  const requestBody: ResendBroadcastRequest = {
    segment_id: segmentId,
    from: `Teach Anything™ <${fromEmail}>`,
    subject: params.subject,
    name: params.subject,
    html,
    send: true,
  };

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/broadcasts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (fetchError) {
    const message =
      fetchError instanceof Error ? fetchError.message : "Network error";
    logError(new Error(message), "Resend broadcasts fetch failed", debugCtx);
    throw new Error(`Broadcast failed: network error — ${message}`);
  }

  let payload: ResendBroadcastResponse;
  try {
    payload = (await res.json()) as ResendBroadcastResponse;
  } catch {
    logError(
      new Error("Non-JSON response from Resend"),
      "Resend broadcasts API returned non-JSON",
      { ...debugCtx, httpStatus: res.status },
    );
    throw new Error(
      `Broadcast failed: unexpected response (HTTP ${res.status})`,
    );
  }

  if ("id" in payload) {
    logInfo("Newsletter broadcast sent", { broadcastId: payload.id });
    return { broadcastId: payload.id };
  }

  logError(new Error(payload.message), "Resend broadcasts API failed", {
    ...debugCtx,
    httpStatus: res.status,
    resendErrorName: payload.name,
    resendErrorMessage: payload.message,
    resendStatusCode: payload.statusCode,
  });
  throw new Error(
    `Broadcast failed (HTTP ${res.status}): ${payload.name} — ${payload.message}`,
  );
}
