import { eq, and, or, isNull, inArray, sql } from "drizzle-orm";
import { userFiles, chatbotFileAssociations } from "@teachanything/db/schema";
import {
  CURRENT_PROCESSING_VERSION,
  processFile,
} from "@/server/file-processor";
import { publishFileProcessingJob } from "@/server/qstash";
import { env } from "@/lib/env";
import { logError, logInfo } from "@/lib/logger";
import type { db as DbType } from "@teachanything/db";

/** Max stale files (re)enqueued per chat access — throttles the migration burst. */
const REPROCESS_BATCH_SIZE = 5;

/**
 * A file waiting in the processing queue still reads `completed` (and must:
 * search only reads completed files), so without a marker every chat turn
 * would queue it again, and each extra job re-embeds a finished file. The
 * marker lives in metadata, which processing overwrites as soon as it starts.
 * If a job is lost, the file becomes eligible again after this long.
 */
const REQUEUE_AFTER = "1 hour";

const isNotQueued = sql`coalesce((${userFiles.metadata} ->> 'reprocessQueuedAt')::timestamptz, 'epoch') < now() - ${REQUEUE_AFTER}::interval`;

const isOldVersion = or(
  isNull(sql`${userFiles.metadata} ->> 'processingVersion'`),
  sql`(${userFiles.metadata} ->> 'processingVersion')::int < ${CURRENT_PROCESSING_VERSION}`,
);

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
    const candidates = await db
      .select({ fileId: userFiles.id })
      .from(chatbotFileAssociations)
      .innerJoin(userFiles, eq(chatbotFileAssociations.fileId, userFiles.id))
      .where(
        and(
          eq(chatbotFileAssociations.chatbotId, chatbotId),
          eq(userFiles.processingStatus, "completed"),
          isOldVersion,
          isNotQueued,
        ),
      )
      // Throttle: only (re)enqueue a small batch per chat access so a chatbot
      // with many stale files doesn't fire a thundering herd of reprocess jobs
      // that starves the live request.
      .limit(REPROCESS_BATCH_SIZE);
    if (candidates.length === 0) return;

    // Claim before publishing. The conditions are re-checked on the row, so two
    // chat turns racing for the same file claim it once between them.
    const stale = await db
      .update(userFiles)
      .set({
        metadata: sql`coalesce(${userFiles.metadata}, '{}'::jsonb) || jsonb_build_object('reprocessQueuedAt', now())`,
      })
      .where(
        and(
          inArray(
            userFiles.id,
            candidates.map((c) => c.fileId),
          ),
          eq(userFiles.processingStatus, "completed"),
          isNotQueued,
        ),
      )
      .returning({ fileId: userFiles.id, userId: userFiles.userId });
    if (stale.length === 0) return;

    logInfo("Lazy reprocess: enqueuing stale files", {
      chatbotId,
      count: stale.length,
    });
    // Match finalize-upload's gate: process inline in development (QStash can't
    // deliver to localhost), publish to QStash in production. Each file is
    // isolated so one failure doesn't abort the rest of the batch.
    const inlineDev = env.NODE_ENV === "development";
    for (const { fileId, userId } of stale) {
      if (inlineDev) {
        void processFile({ fileId }).catch((e) =>
          logError(e, "Inline reprocess failed", { fileId }),
        );
      } else {
        try {
          await publishFileProcessingJob({ fileId, userId });
        } catch (e) {
          logError(e, "Failed to enqueue reprocess job", { fileId });
        }
      }
    }
  } catch (error) {
    logError(error, "maybeEnqueueReprocess failed", { chatbotId });
  }
}
