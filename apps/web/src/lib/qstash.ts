import { Client, Receiver } from "@upstash/qstash";
import { isServiceAvailable, env } from "./env";
import { logInfo, logError } from "./logger";

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
 * Publish a QStash job.
 * When QStash is not configured, logs to console and returns a fake messageId.
 */
export async function publishQStashJob(params: {
  url: string;
  body: Record<string, unknown>;
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
