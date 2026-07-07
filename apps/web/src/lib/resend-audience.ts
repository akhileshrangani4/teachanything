import { Resend } from "resend";
import { env, isServiceAvailable } from "./env";
import { logInfo, logError } from "./logger";

/**
 * Add a user to the Resend audience configured via RESEND_AUDIENCE_ID.
 *
 * No-op when Resend or the audience is not configured. Never throws —
 * audience sync must not block user approval. Resend deduplicates
 * contacts by email within an audience, so repeat calls are safe.
 *
 * Returns true when the contact was added, false when skipped or failed.
 */
export async function syncUserToResendAudience(params: {
  email: string;
  name?: string | null;
}): Promise<boolean> {
  if (!isServiceAvailable("resend") || !env.RESEND_AUDIENCE_ID) {
    return false;
  }

  try {
    const resend = new Resend(env.RESEND_API_KEY!);
    const { error } = await resend.contacts.create({
      audienceId: env.RESEND_AUDIENCE_ID,
      email: params.email,
      firstName: params.name || undefined,
      unsubscribed: false,
    });

    if (error) {
      logError(
        new Error(error.message),
        "Failed to add contact to Resend audience",
        { email: params.email },
      );
      return false;
    }

    logInfo("Contact added to Resend audience", { email: params.email });
    return true;
  } catch (error) {
    logError(error, "Failed to add contact to Resend audience", {
      email: params.email,
    });
    return false;
  }
}
