import { eq, and, or, isNull, sql } from "drizzle-orm";
import { userFiles, chatbotFileAssociations } from "@teachanything/db/schema";
import { CURRENT_PROCESSING_VERSION, processFile } from "@/lib/file-processor";
import { publishQStashJob } from "@/lib/qstash";
import { env } from "@/lib/env";
import { logError, logInfo } from "@/lib/logger";
import type { db as DbType } from "@teachanything/db";

/** Max stale files (re)enqueued per chat access — throttles the migration burst. */
const REPROCESS_BATCH_SIZE = 5;

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
      )
      // Throttle: only (re)enqueue a small batch per chat access so a chatbot
      // with many stale files doesn't fire a thundering herd of reprocess jobs
      // that starves the live request. In-flight files flip to "processing" and
      // drop out of this query, so successive accesses drain the rest.
      .limit(REPROCESS_BATCH_SIZE);
    if (stale.length === 0) return;
    logInfo("Lazy reprocess: enqueuing stale files", {
      chatbotId,
      count: stale.length,
    });
    // Match finalize-upload's gate: process inline in development (QStash can't
    // deliver to localhost), publish to QStash in production. Each file is
    // isolated so one failure doesn't abort the rest of the batch.
    const inlineDev = env.NODE_ENV === "development";
    for (const { fileId } of stale) {
      if (inlineDev) {
        void processFile({ fileId }).catch((e) =>
          logError(e, "Inline reprocess failed", { fileId }),
        );
      } else {
        try {
          await publishQStashJob({
            url: `${env.NEXT_PUBLIC_APP_URL}/api/jobs/process-file`,
            body: { fileId },
          });
        } catch (e) {
          logError(e, "Failed to enqueue reprocess job", { fileId });
        }
      }
    }
  } catch (error) {
    logError(error, "maybeEnqueueReprocess failed", { chatbotId });
  }
}
