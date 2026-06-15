import { eq, and, or, isNull, sql } from "drizzle-orm";
import { userFiles, chatbotFileAssociations } from "@teachanything/db/schema";
import { CURRENT_PROCESSING_VERSION, processFile } from "@/lib/file-processor";
import { isLocalStorageMode } from "@/lib/local-storage";
import { publishQStashJob } from "@/lib/qstash";
import { env } from "@/lib/env";
import { logError, logInfo } from "@/lib/logger";
import type { db as DbType } from "@teachanything/db";

/**
 * Lazily reprocess files ingested under an older processing version so they gain
 * page-aware chunks + pageNumber metadata (issue #271). Non-blocking and
 * best-effort: never throws into the chat path.
 */
export async function maybeEnqueueReprocess(
  db: typeof DbType,
  chatbotId: string,
): Promise<void> {
  try {
    const stale = await db
      .select({ fileId: userFiles.id })
      .from(chatbotFileAssociations)
      .innerJoin(userFiles, eq(chatbotFileAssociations.fileId, userFiles.id))
      .where(
        and(
          eq(chatbotFileAssociations.chatbotId, chatbotId),
          eq(userFiles.processingStatus, "completed"),
          or(
            isNull(sql`${userFiles.metadata} ->> 'processingVersion'`),
            sql`(${userFiles.metadata} ->> 'processingVersion')::int < ${CURRENT_PROCESSING_VERSION}`,
          ),
        ),
      );
    if (stale.length === 0) return;
    logInfo("Lazy reprocess: enqueuing stale files", {
      chatbotId,
      count: stale.length,
    });
    for (const { fileId } of stale) {
      if (isLocalStorageMode()) {
        void processFile({ fileId }).catch((e) =>
          logError(e, "Inline reprocess failed", { fileId }),
        );
      } else {
        // Enqueue via QStash — same helper, url, and body { fileId } as
        // files/procedures/finalize-upload.ts.
        await publishQStashJob({
          url: `${env.NEXT_PUBLIC_APP_URL}/api/jobs/process-file`,
          body: { fileId },
        });
      }
    }
  } catch (error) {
    logError(error, "maybeEnqueueReprocess failed", { chatbotId });
  }
}
