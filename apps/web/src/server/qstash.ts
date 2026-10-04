import { Client, Receiver } from "@upstash/qstash";
import { isServiceAvailable, env } from "@/lib/env";
import { logInfo, logError } from "@/lib/logger";

// Conditionally create QStash client and receiver
export const qstash = isServiceAvailable("qstash")
  ? new Client({ token: env.QSTASH_TOKEN! })
  : null;

export const qstashReceiver = isServiceAvailable("qstash")
  ? new Receiver({
      currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY!,
      nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY!,
    })
  : null;

/**
 * How many jobs of one kind QStash runs at once.
 *
 * Every processing job writes embeddings into one Micro database. Unlimited, a
 * 20-file upload or a 100-page crawl started that many jobs together; they took
 * every pooler connection, and the uploads still finalizing behind them timed
 * out waiting for one (Oct 1 2026: a SCRAM timeout on the pooler, then a
 * finalize that never wrote its row). Extra jobs wait in QStash, not in the
 * pooler.
 *
 * Keyed per owner, not globally: with one shared line, a 500-page crawl would
 * hold every other crawl's pages in the queue long enough for the 30-minute
 * crawl stale check to fail them. Separate owners rarely overlap, so the
 * database still sees a handful of jobs at a time.
 */
const JOBS_AT_ONCE = 3;

type FlowControl = { key: string; parallelism: number };

export function fileProcessingFlow(userId: string): FlowControl {
  return { key: `process-file-${userId}`, parallelism: JOBS_AT_ONCE };
}

export function crawlPageFlow(crawlSourceId: string): FlowControl {
  return {
    key: `crawl-process-page-${crawlSourceId}`,
    parallelism: JOBS_AT_ONCE,
  };
}

/**
 * Publish a QStash job.
 * When QStash is not configured, logs to console and returns a fake messageId.
 */
export async function publishQStashJob(params: {
  url: string;
  body: Record<string, unknown>;
  flowControl?: FlowControl;
}): Promise<{ messageId: string }> {
  if (!qstash) {
    logInfo("[dev] QStash not configured — job skipped", {
      url: params.url,
      body: params.body,
    });
    return { messageId: `dev-noop-${Date.now()}` };
  }

  try {
    const result = await qstash.publishJSON({
      url: params.url,
      body: params.body,
      retries: 3,
      flowControl: params.flowControl,
      headers: {
        "Content-Type": "application/json",
      },
    });

    logInfo("QStash job published", {
      url: params.url,
      messageId: result.messageId,
    });

    return { messageId: result.messageId };
  } catch (error) {
    logError(error, "Failed to publish QStash job", {
      url: params.url,
    });
    throw error;
  }
}

/** Queue processing for one uploaded file, in line behind its owner's others. */
export async function publishFileProcessingJob(params: {
  fileId: string;
  userId: string;
}): Promise<{ messageId: string }> {
  return publishQStashJob({
    url: `${env.NEXT_PUBLIC_APP_URL}/api/jobs/process-file`,
    body: { fileId: params.fileId },
    flowControl: fileProcessingFlow(params.userId),
  });
}

/**
 * Publish an email job to QStash with more retries than standard jobs.
 * When QStash is not configured, logs to console and returns a fake messageId.
 */
export async function publishEmailJob(params: {
  body: Record<string, unknown>;
}): Promise<{ messageId: string }> {
  if (!qstash) {
    const { to, subject } = params.body;
    console.warn(
      `[dev] Email job skipped (no QStash). To: ${JSON.stringify(to)}, Subject: ${subject}`,
    );
    return { messageId: `dev-noop-${Date.now()}` };
  }

  try {
    const result = await qstash.publishJSON({
      url: `${env.NEXT_PUBLIC_APP_URL}/api/jobs/send-email`,
      body: params.body,
      retries: 5,
      headers: {
        "Content-Type": "application/json",
      },
    });

    logInfo("Email job published to QStash", {
      messageId: result.messageId,
    });

    return { messageId: result.messageId };
  } catch (error) {
    logError(error, "Failed to publish email job to QStash");
    throw error;
  }
}

/**
 * Verify QStash signature for incoming requests.
 * Returns false when receiver is not configured.
 */
export async function verifyQStashSignature(
  signature: string,
  body: string,
  url: string,
): Promise<boolean> {
  if (!qstashReceiver) {
    return false;
  }

  try {
    const isValid = await qstashReceiver.verify({
      signature,
      body,
      url,
    });

    return isValid;
  } catch (error) {
    logError(error, "Failed to verify QStash signature");
    return false;
  }
}
