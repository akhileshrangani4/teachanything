import { APIError } from "better-auth";
import { db } from "@teachanything/db";
import * as schema from "@teachanything/db/schema";
import { logInfo, logError } from "@/lib/logger";
import { sendAdminNotificationEmail } from "../email";
import { eq } from "drizzle-orm";

/**
 * Set a freshly created user to `pending` and notify the admins.
 *
 * If the admin notification fails, the just-created user is deleted and the
 * registration fails, so no unnotified account can linger in the pending list.
 */
export async function registerPendingUserAndNotify(user: {
  id: string;
  email: string;
  name?: string | null;
}) {
  try {
    logInfo("New user created", {
      userId: user.id,
      email: user.email,
    });

    // Set user status to pending
    await db
      .update(schema.user)
      .set({ status: "pending" })
      .where(eq(schema.user.id, user.id));

    // Send notification to admins - this is critical, so we fail if it doesn't work
    await sendAdminNotificationEmail({
      userId: user.id,
      email: user.email,
      name: user.name || "Unknown",
    });

    logInfo("User set to pending and admin notified", {
      userId: user.id,
      email: user.email,
    });
  } catch (error) {
    // If email notification fails, delete the user and fail the registration
    logError(
      error,
      "Failed to send admin notification, rolling back user creation",
      {
        userId: user.id,
        email: user.email,
      },
    );

    try {
      await db.delete(schema.user).where(eq(schema.user.id, user.id));

      logInfo("User deleted due to notification failure", {
        userId: user.id,
        email: user.email,
      });
    } catch (deleteError) {
      logError(
        deleteError,
        "Failed to delete user after notification failure",
        {
          userId: user.id,
        },
      );
    }

    // Re-throw error to fail the registration
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message:
        "Unable to complete registration. Please try again later or contact support.",
    });
  }
}
