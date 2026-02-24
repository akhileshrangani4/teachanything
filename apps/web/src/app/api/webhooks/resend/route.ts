import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";
import { logInfo, logError, logWarn } from "@/lib/logger";
import { db } from "@teachanything/db";
import { emailDeliveries } from "@teachanything/db/schema";
import { eq, sql } from "drizzle-orm";

type ResendWebhookEvent = {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    bounce?: {
      message: string;
      subType: string;
      type: string;
    };
  };
};

// Status priority for handling out-of-order webhook events.
// Higher number = more advanced state. Terminal states get special handling.
const STATUS_PRIORITY: Record<string, number> = {
  queued: 0,
  sent: 1,
  delayed: 2,
  delivered: 3,
};

// "failed" is set by the QStash job endpoint, not by Resend webhooks,
// but we still treat it as terminal to prevent webhooks from overwriting it.
const TERMINAL_STATUSES = new Set(["bounced", "complained", "failed"]);

const EVENT_TO_STATUS: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

const WEBHOOK_TOLERANCE_SECONDS = 300; // 5 minutes

/**
 * Verify Resend webhook signature (svix format).
 * Resend uses svix under the hood — signatures are base64-encoded HMACs.
 */
function verifyWebhookSignature(
  payload: string,
  headers: { id: string; timestamp: string; signature: string },
  secret: string,
): boolean {
  const { id, timestamp, signature } = headers;

  if (!id || !timestamp || !signature) {
    return false;
  }

  // Check timestamp is within tolerance (replay protection)
  const timestampSeconds = parseInt(timestamp, 10);
  if (Number.isNaN(timestampSeconds)) {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampSeconds) > WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }

  // Decode the secret (svix secrets are base64-encoded, prefixed with "whsec_")
  const secretBytes = Buffer.from(
    secret.startsWith("whsec_") ? secret.slice(6) : secret,
    "base64",
  );

  // Compute expected signature
  const signedContent = `${id}.${timestamp}.${payload}`;
  const expectedSignature = createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  // The signature header may contain multiple signatures separated by spaces
  // Each is prefixed with "v1,"
  const signatures = signature.split(" ");
  for (const sig of signatures) {
    const sigValue = sig.startsWith("v1,") ? sig.slice(3) : sig;
    try {
      const expected = Buffer.from(expectedSignature);
      const received = Buffer.from(sigValue);
      if (
        expected.length === received.length &&
        timingSafeEqual(expected, received)
      ) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    // Guard: Resend webhook secret must be configured
    if (!env.RESEND_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Resend webhook is not configured" },
        { status: 503 },
      );
    }

    // Read raw body FIRST — critical for signature verification
    const payload = await req.text();

    // Verify webhook signature
    const isValid = verifyWebhookSignature(
      payload,
      {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      env.RESEND_WEBHOOK_SECRET,
    );

    if (!isValid) {
      logWarn("Invalid Resend webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(payload) as ResendWebhookEvent;

    // Map event type to delivery status
    const newStatus = EVENT_TO_STATUS[event.type];
    if (!newStatus) {
      logInfo("Ignoring unhandled webhook event type", { type: event.type });
      return NextResponse.json({ received: true });
    }

    const resendMessageId = event.data.email_id;

    // Find the delivery record
    const [existing] = await db
      .select({
        id: emailDeliveries.id,
        deliveryStatus: emailDeliveries.deliveryStatus,
      })
      .from(emailDeliveries)
      .where(eq(emailDeliveries.resendMessageId, resendMessageId))
      .limit(1);

    if (!existing) {
      // Webhook arrived before QStash job completed — log and accept
      logWarn("No delivery record found for webhook event", {
        resendMessageId,
        eventType: event.type,
      });
      return NextResponse.json({ received: true });
    }

    // Enforce status priority ordering to handle out-of-order events
    const currentStatus = existing.deliveryStatus;
    const isCurrentTerminal = TERMINAL_STATUSES.has(currentStatus);

    if (isCurrentTerminal) {
      logInfo("Ignoring webhook event — delivery already in terminal state", {
        resendMessageId,
        currentStatus,
        incomingStatus: newStatus,
      });
      return NextResponse.json({ received: true });
    }

    const currentPriority = STATUS_PRIORITY[currentStatus] ?? -1;
    const newPriority = STATUS_PRIORITY[newStatus] ?? -1;
    const isNewTerminal = TERMINAL_STATUSES.has(newStatus);

    // Only update if incoming status has higher priority or is terminal
    if (!isNewTerminal && newPriority <= currentPriority) {
      logInfo("Ignoring webhook event — lower priority than current status", {
        resendMessageId,
        currentStatus,
        incomingStatus: newStatus,
      });
      return NextResponse.json({ received: true });
    }

    // Update delivery status
    await db
      .update(emailDeliveries)
      .set({
        deliveryStatus: sql`${newStatus}::email_delivery_status`,
        lastEventAt: new Date(event.created_at),
        updatedAt: new Date(),
        ...(event.data.bounce && {
          metadata: { bounce: event.data.bounce },
          errorMessage: event.data.bounce.message,
        }),
      })
      .where(eq(emailDeliveries.id, existing.id));

    logInfo("Resend webhook processed", {
      type: event.type,
      resendMessageId,
      status: newStatus,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    logError(error, "Resend webhook handler failed");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
