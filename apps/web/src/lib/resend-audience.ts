import { Resend, type CreateContactRequestOptions } from "resend";
import { env } from "./env";
import { logInfo, logWarn, logError } from "./logger";

// The Resend SDK sets no fetch timeout. A human waits on the approval
// mutation, so bound the call tightly and abort the underlying request when
// it expires (see below) rather than letting it run on in the background.
const CREATE_TIMEOUT_MS = 5_000;

/**
 * Split a single display name into Resend's first/last name fields. The user
 * schema only stores one `name`, so this is a best-effort split on whitespace:
 * the first token is the first name, everything after is the last name.
 */
function splitName(name?: string | null): {
  firstName?: string;
  lastName?: string;
} {
  const trimmed = name?.trim();
  if (!trimmed) return {};
  const [first, ...rest] = trimmed.split(/\s+/);
  return {
    firstName: first,
    lastName: rest.length ? rest.join(" ") : undefined,
  };
}

/**
 * Add a user to the Resend audience configured via RESEND_AUDIENCE_ID.
 *
 * Never throws and never rolls back approval: every failure path returns a
 * logged `false`, and the caller commits the approval before calling this.
 * It is not zero-cost, though — on a hung Resend the call blocks the approval
 * mutation for up to CREATE_TIMEOUT_MS before returning, at which point the
 * in-flight request is aborted.
 *
 * The payload omits `unsubscribed` because Resend does not document
 * duplicate-create semantics: if creating an existing contact updates it,
 * sending `unsubscribed: false` could silently overwrite an opt-out.
 *
 * Returns true when the contact was added, false when skipped or failed.
 */
export async function syncUserToResendAudience(params: {
  email: string;
  name?: string | null;
}): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY;
  const audienceId = env.RESEND_AUDIENCE_ID;

  // Resend not configured at all: an intentional no-op on deploys that don't
  // use email. Quiet (logWarn is gated behind ENABLE_LOGGING).
  if (!apiKey) {
    logWarn("Resend audience sync skipped — RESEND_API_KEY not configured", {
      email: params.email,
    });
    return false;
  }

  // API key is set but the audience isn't: a real misconfiguration that would
  // otherwise silently disable the feature in prod. logError always writes
  // (unlike logWarn/logInfo), so operators actually see this.
  if (!audienceId) {
    logError(
      new Error("RESEND_AUDIENCE_ID not configured"),
      "Resend audience sync skipped — RESEND_API_KEY is set but RESEND_AUDIENCE_ID is missing",
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

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const resend = new Resend(apiKey);
    const { firstName, lastName } = splitName(params.name);

    // The SDK forwards request options into the underlying fetch, so `signal`
    // aborts the real request on timeout. It isn't in the SDK's option type,
    // hence the cast.
    const requestOptions = {
      signal: controller.signal,
    } as CreateContactRequestOptions;

    const createPromise = resend.contacts.create(
      { audienceId, email: params.email, firstName, lastName },
      requestOptions,
    );
    // If the timeout wins the race, createPromise may still reject later (once
    // the abort propagates); swallow it so it doesn't surface as an unhandled
    // rejection.
    createPromise.catch(() => {});

    const { error } = await Promise.race([
      createPromise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(
            new Error(
              `Resend contacts.create timed out after ${CREATE_TIMEOUT_MS}ms`,
            ),
          );
        }, CREATE_TIMEOUT_MS);
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
