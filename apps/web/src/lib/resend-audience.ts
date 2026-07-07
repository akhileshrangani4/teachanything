import { Resend } from "resend";
import { env, isServiceAvailable } from "./env";
import { logInfo, logWarn, logError } from "./logger";

// The Resend SDK sets no fetch timeout; bound the call so a hung request
// can't stall the admin approval mutation
const CREATE_TIMEOUT_MS = 10_000;

/**
 * Add a user to the Resend audience configured via RESEND_AUDIENCE_ID.
 *
 * No-op (with a warning) when Resend or the audience is not configured.
 * Never throws — audience sync must not block user approval. The payload
 * omits `unsubscribed` because Resend does not document duplicate-create
 * semantics: if creating an existing contact updates it, sending
 * `unsubscribed: false` could silently overwrite an opt-out.
 *
 * Returns true when the contact was added, false when skipped or failed.
 */
export async function syncUserToResendAudience(params: {
  email: string;
  name?: string | null;
}): Promise<boolean> {
  if (!isServiceAvailable("resend") || !env.RESEND_AUDIENCE_ID) {
    logWarn(
      "Resend audience sync skipped — RESEND_API_KEY or RESEND_AUDIENCE_ID not configured",
      { email: params.email },
    );
    return false;
  }

  const logFailure = (error: unknown) => {
    logError(error, "Failed to add contact to Resend audience", {
      email: params.email,
    });
    return false;
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const resend = new Resend(env.RESEND_API_KEY!);
    const { error } = await Promise.race([
      resend.contacts.create({
        audienceId: env.RESEND_AUDIENCE_ID,
        email: params.email,
        firstName: params.name || undefined,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `Resend contacts.create timed out after ${CREATE_TIMEOUT_MS}ms`,
              ),
            ),
          CREATE_TIMEOUT_MS,
        );
      }),
    ]);

    if (error) return logFailure(error);

    logInfo("Contact added to Resend audience", { email: params.email });
    return true;
  } catch (error) {
    return logFailure(error);
  } finally {
    clearTimeout(timer);
  }
}
