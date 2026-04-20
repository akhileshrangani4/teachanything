import { eq } from "drizzle-orm";
import {
  user,
  userFiles,
  approvedDomains,
  emailDeliveries,
} from "@teachanything/db/schema";
import { createSupabaseClient } from "@/lib/supabase";
import { isServiceAvailable } from "@/lib/env";
import { sendAccountDeletedEmail } from "@/lib/email";
import { logInfo, logError } from "@/lib/logger";
import type { db as DbType } from "@teachanything/db";

/**
 * Delete a user account and all associated data.
 *
 * Handles: storage file cleanup, domain reference nullification,
 * cascading DB delete, and confirmation email. Both the admin
 * deleteUser and self-service deleteOwnAccount mutations call this
 * after their own authorization checks.
 */
export async function deleteUserAccount(
  db: typeof DbType,
  params: {
    userId: string;
    email: string;
    name: string;
    deletedBy?: string;
  },
): Promise<void> {
  const { userId, email, name, deletedBy } = params;

  logInfo("Starting user deletion", {
    userId,
    email,
    ...(deletedBy && { deletedBy }),
  });

  // Delete files from Supabase Storage
  const userFilesList = await db
    .select({ storagePath: userFiles.storagePath })
    .from(userFiles)
    .where(eq(userFiles.userId, userId));

  if (userFilesList.length > 0 && isServiceAvailable("supabase-storage")) {
    const supabase = createSupabaseClient();
    const storagePaths = userFilesList.map(
      (f: { storagePath: string }) => f.storagePath,
    );

    const { error: storageError } = await supabase.storage
      .from("chatbot-files")
      .remove(storagePaths);

    if (storageError) {
      logError(storageError, "Failed to delete some files from storage", {
        userId,
        fileCount: userFilesList.length,
      });
    } else {
      logInfo("Deleted files from storage", {
        userId,
        fileCount: userFilesList.length,
      });
    }
  }

  // Wrap DB writes in a transaction to prevent partial deletion on crash
  await db.transaction(async (tx) => {
    // Nullify approved_domains.created_by references
    await tx
      .update(approvedDomains)
      .set({ createdBy: null })
      .where(eq(approvedDomains.createdBy, userId));

    // Scrub PII from email delivery records (GDPR right-to-erasure)
    await tx
      .delete(emailDeliveries)
      .where(eq(emailDeliveries.recipientEmail, email));

    // Delete the user (cascade handles: sessions, accounts, chatbots, files, conversations, messages, analytics)
    await tx.delete(user).where(eq(user.id, userId));
  });

  logInfo("User deleted successfully", {
    userId,
    email,
    ...(deletedBy && { deletedBy }),
  });

  // Send confirmation email after successful deletion
  try {
    await sendAccountDeletedEmail({ email, name });
  } catch (error) {
    logError(error, "Failed to send account deleted email", {
      userId,
      email,
    });
  }
}
