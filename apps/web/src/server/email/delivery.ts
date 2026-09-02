import { render } from "@react-email/render";
import { env, isServiceAvailable } from "@/lib/env";
import { logInfo } from "@/lib/logger";
import { publishEmailJob } from "../qstash";
import { db } from "@teachanything/db";
import { emailDeliveries, type emailTypeEnum } from "@teachanything/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export type EmailType = (typeof emailTypeEnum.enumValues)[number];

/**
 * Queue an email for delivery via QStash.
 * Creates a delivery tracking record and publishes the job.
 *
 * When QStash is not configured (local dev), logs the email to console
 * and marks delivery as "sent" so downstream code (auth hooks) succeeds.
 */
export async function queueEmail(params: {
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
        from: `Teach Anything® <${fromEmail}>`,
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
