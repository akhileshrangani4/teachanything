import { eq } from "drizzle-orm";
import {
  user,
  userFiles,
  approvedDomains,
  emailDeliveries,
} from "@teachanything/db/schema";
import { removeStoredFiles } from "@/server/storage-removal";
import { isCrawledPagePath } from "@/server/crawled-page-files";
import { sendAccountDeletedEmail } from "@/server/email";
import { logInfo, logError } from "@/lib/logger";
import type { db as DbType } from "@teachanything/db";

/**
 * Storage cleanup failed, so nothing in the database was touched. The account
 * is intact and deleting it again is safe.
 */
export class StorageCleanupError extends Error {
  constructor(options: { cause: unknown }) {
    super("Couldn't remove your files — please try again", options);
    this.name = "StorageCleanupError";
  }
}

/**
 * The object keys to remove from storage for a user's `userFiles` rows.
 * Crawled pages store their URL in `storagePath` and have no stored object.
 */
export function storagePathsToRemove(
  rows: ReadonlyArray<{ storagePath: string }>,
): string[] {
  return rows
    .map((row) => row.storagePath)
    .filter((storagePath) => !isCrawledPagePath(storagePath));
}

/**
 * Delete a user account and all associated data.
 *
 * Handles: storage file cleanup, domain reference nullification,
 * cascading DB delete, and confirmation email. Both the admin
 * deleteUser and self-service deleteOwnAccount mutations call this
 * after their own authorization checks.
 *
 * Fails closed: stored files are removed first, and if that fails it throws
 * `StorageCleanupError` before any database write. Deleting the rows anyway
 * would leave the files in storage with nothing pointing at them.
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

  const storagePaths = storagePathsToRemove(
    await db
      .select({ storagePath: userFiles.storagePath })
      .from(userFiles)
      .where(eq(userFiles.userId, userId)),
  );

  try {
    await removeStoredFiles(storagePaths);
  } catch (error) {
    throw new StorageCleanupError({ cause: error });
  }

  if (storagePaths.length > 0) {
    logInfo("Deleted files from storage", {
      userId,
      fileCount: storagePaths.length,
    });
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
