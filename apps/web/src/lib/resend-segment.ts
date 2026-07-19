import { Resend, type CreateContactRequestOptions } from "resend";
import { env } from "./env";
import { logInfo, logWarn, logError } from "./logger";

// A human waits on the approval mutation, so bound the request tightly.
// AbortSignal.timeout both bounds the latency and aborts the request.
const CREATE_TIMEOUT_MS = 5_000;

/**
 * Split a single display name into Resend's firstName/lastName fields. The
 * user schema only stores one `name`, so this is a best-effort split on
 * whitespace: the first token is the first name, everything after is the last.
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
 * Add a user to the Resend segment configured via RESEND_SEGMENT_ID.
 *
 * Uses the current Contacts API (global contact + `segments`) — the Audiences
 * API this originally targeted is deprecated in favour of Segments.
 *
 * Never throws and never rolls back approval: every failure path returns a
 * logged `false`, and the caller commits the approval before calling this.
 * It is not zero-cost — on a hung Resend it blocks the approval mutation for
 * up to CREATE_TIMEOUT_MS, at which point the request is aborted.
 *
 * The payload omits `unsubscribed` so that re-creating an existing contact can
 * never silently overwrite an opt-out.
 *
 * Returns true when the contact was added (or already present), false when
 * skipped or failed.
 */
export async function syncUserToResendSegment(params: {
  email: string;
  name?: string | null;
}): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY;
  const segmentId = env.RESEND_SEGMENT_ID;

  // Resend not configured at all: an intentional no-op on deploys that don't
  // use email. Quiet (logWarn is gated behind ENABLE_LOGGING).
  if (!apiKey) {
    logWarn("Resend segment sync skipped — RESEND_API_KEY not configured", {
      email: params.email,
    });
    return false;
  }

  // API key is set but the segment isn't: a real misconfiguration that would
  // otherwise silently disable the feature in prod. logError always writes
  // (unlike logWarn/logInfo), so operators actually see this.
  if (!segmentId) {
    logError(
      new Error("RESEND_SEGMENT_ID not configured"),
      "Resend segment sync skipped — RESEND_API_KEY is set but RESEND_SEGMENT_ID is missing",
      { email: params.email },
    );
    return false;
  }

  const logFailure = (error: unknown) => {
    logError(error, "Failed to add contact to Resend segment", {
      email: params.email,
    });
    return false;
  };

  try {
    const resend = new Resend(apiKey);
    const { firstName, lastName } = splitName(params.name);

    const { error } = await resend.contacts.create(
      {
        email: params.email,
        firstName,
        lastName,
        segments: [{ id: segmentId }],
      },
      // The SDK forwards request options to fetch, so AbortSignal.timeout both
      // bounds and aborts the request. `signal` isn't in the option type, hence
      // the cast.
      {
        signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
      } as CreateContactRequestOptions,
    );

    if (error) {
      // Contact already exists — treat as success, the user is a contact.
      if (error.statusCode === 409 || /already/i.test(error.message)) {
        logInfo("Contact already present in Resend", { email: params.email });
        return true;
      }
      return logFailure(error);
    }

    logInfo("Contact added to Resend segment", { email: params.email });
    return true;
  } catch (error) {
    return logFailure(error);
  }
}
