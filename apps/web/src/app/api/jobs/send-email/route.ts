import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { verifyQStashSignature } from "@/lib/qstash";
import { env } from "@/lib/env";
import { logInfo, logError } from "@/lib/logger";
import { db } from "@teachanything/db";
import { emailDeliveries } from "@teachanything/db/schema";
import { eq } from "drizzle-orm";

const resend = new Resend(env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    // Verify QStash signature
    const signature =
      req.headers.get("Upstash-Signature") ||
      req.headers.get("upstash-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const body = await req.text();
    // Use NEXT_PUBLIC_APP_URL as the base for verification because QStash signs
    // the destination URL it was given (e.g., ngrok URL), which differs from
    // req.url in local dev (localhost:3000).
    const verificationUrl = `${env.NEXT_PUBLIC_APP_URL}/api/jobs/send-email`;
    const isValid = await verifyQStashSignature(signature, body, verificationUrl);

    if (!isValid) {
      logError(
        new Error("Invalid QStash signature"),
        "Email sending job rejected",
      );
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse email job payload
    const { deliveryId, idempotencyKey, from, to, subject, html, replyTo } =
      JSON.parse(body) as {
        deliveryId: string;
        idempotencyKey: string;
        from: string;
        to: string | string[];
        subject: string;
        html: string;
        replyTo?: string;
      };

    // Send via Resend with idempotency key
    const { data, error } = await resend.emails.send(
      {
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        ...(replyTo && { replyTo }),
      },
      { idempotencyKey },
    );

    if (error) {
      // Update delivery record with failure
      if (deliveryId) {
        await db
          .update(emailDeliveries)
          .set({
            deliveryStatus: "failed",
            errorMessage: error.message,
            updatedAt: new Date(),
          })
          .where(eq(emailDeliveries.id, deliveryId));
      }

      // Validation errors won't succeed on retry — return 400 to stop QStash
      if (
        error.name === "validation_error" ||
        error.name === "missing_required_field"
      ) {
        logError(
          new Error(error.message),
          "Email validation failed, not retrying",
          { deliveryId },
        );
        return NextResponse.json(
          { error: error.message },
          { status: 400 },
        );
      }

      // Transient errors — return 500 so QStash retries
      throw new Error(`Resend error: ${error.message}`);
    }

    // Update delivery record with Resend message ID
    if (deliveryId && data?.id) {
      await db
        .update(emailDeliveries)
        .set({
          resendMessageId: data.id,
          deliveryStatus: "sent",
          updatedAt: new Date(),
        })
        .where(eq(emailDeliveries.id, deliveryId));
    }

    logInfo("Email sent via QStash job", {
      deliveryId,
      resendMessageId: data?.id,
      to,
    });

    return NextResponse.json({ success: true, messageId: data?.id });
  } catch (error) {
    logError(error, "Email sending job failed");

    // Return 500 so QStash will retry
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
