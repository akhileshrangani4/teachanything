import { APIError } from "better-auth";
import { db } from "@teachanything/db";
import * as schema from "@teachanything/db/schema";
import { logInfo, logError } from "@/lib/logger";
import { eq } from "drizzle-orm";

/**
 * Approval gate for session creation: admins always pass; non-admins must be
 * `approved`. Returns false (or throws, which is caught below) to abort.
 */
export async function gateSessionCreation(session: { userId: string }) {
  try {
    // Check if user is approved before creating session
    const [user] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, session.userId))
      .limit(1);

    if (!user) {
      logError(
        new Error("User not found"),
        "Session creation for non-existent user",
        {
          userId: session.userId,
        },
      );
      return false; // Abort session creation
    }

    // Admins bypass the approval workflow
    if (user.role === "admin") {
      logInfo("Session creation approved for admin", {
        userId: user.id,
        email: user.email,
        role: user.role,
      });
      return true; // Allow session creation for admins
    }

    // For non-admin users, check status
    if (user.status === "pending") {
      logInfo("Session creation blocked for pending user", {
        userId: user.id,
        email: user.email,
      });
      throw new APIError("UNAUTHORIZED", {
        message: "ACCOUNT_PENDING",
      });
    }

    if (user.status === "rejected") {
      logInfo("Session creation blocked for rejected user", {
        userId: user.id,
        email: user.email,
      });
      throw new APIError("UNAUTHORIZED", {
        message: "ACCOUNT_REJECTED",
      });
    }

    logInfo("Session creation approved", {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return true; // Allow session creation
  } catch (error) {
    logError(error, "Error in session.create.before hook", {
      userId: session.userId,
    });
    return false; // Abort session creation on error
  }
}
