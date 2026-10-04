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
 */
export const FILE_PROCESSING_FLOW = { key: "process-file", parallelism: 3 };
export const CRAWL_PAGE_FLOW = { key: "crawl-process-page", parallelism: 3 };

type FlowControl = { key: string; parallelism: number };

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

/** Queue processing for one uploaded file, under the file-processing cap. */
export async function publishFileProcessingJob(
  fileId: string,
): Promise<{ messageId: string }> {
  return publishQStashJob({
    url: `${env.NEXT_PUBLIC_APP_URL}/api/jobs/process-file`,
    body: { fileId },
    flowControl: FILE_PROCESSING_FLOW,
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
