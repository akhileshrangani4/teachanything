import { db } from "@teachanything/db";
import * as schema from "@teachanything/db/schema";
import { logInfo, logError } from "@/lib/logger";
import { sendApprovalEmail, sendRejectionEmail } from "../email";
import { syncUserToResendSegment } from "../resend-segment";
import { eq } from "drizzle-orm";

// Helper to approve user
export async function approveUser(userId: string): Promise<void> {
  const [user] = await db
    .update(schema.user)
    .set({ status: "approved" })
    .where(eq(schema.user.id, userId))
    .returning();

  if (user) {
    logInfo("User approved", {
      userId: user.id,
      email: user.email,
    });

    // Send approval email
    try {
      await sendApprovalEmail({
        email: user.email,
        name: user.name || "User",
      });
    } catch (error) {
      logError(error, "Failed to send approval email", {
        userId: user.id,
      });
    }

    // Add to Resend segment (never throws; failures logged inside)
    await syncUserToResendSegment({
      email: user.email,
      name: user.name,
    });
  }
}

// Helper to reject user
export async function rejectUser(userId: string): Promise<void> {
  const [user] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  if (user) {
    // Update status to rejected
    await db
      .update(schema.user)
      .set({ status: "rejected" })
      .where(eq(schema.user.id, userId));

    logInfo("User rejected", {
      userId: user.id,
      email: user.email,
    });

    // Send rejection email
    try {
      await sendRejectionEmail({
        email: user.email,
        name: user.name || "User",
      });
    } catch (error) {
      logError(error, "Failed to send rejection email", {
        userId: user.id,
      });
    }
  }
}
