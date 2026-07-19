import { env } from "./env";
import { logInfo, logWarn, logError } from "./logger";

const CONTACTS_ENDPOINT = "https://api.resend.com/contacts";

// A human waits on the approval mutation, so bound the request tightly.
// AbortSignal.timeout both bounds the latency and aborts the request.
const CREATE_TIMEOUT_MS = 5_000;

/**
 * Split a single display name into Resend's first_name/last_name fields. The
 * user schema only stores one `name`, so this is a best-effort split on
 * whitespace: the first token is the first name, everything after is the last.
 */
function splitName(name?: string | null): {
  first_name?: string;
  last_name?: string;
} {
  const trimmed = name?.trim();
  if (!trimmed) return {};
  const [first, ...rest] = trimmed.split(/\s+/);
  return {
    first_name: first,
    last_name: rest.length ? rest.join(" ") : undefined,
  };
}

/**
 * Add a user to the Resend segment configured via RESEND_SEGMENT_ID.
 *
 * Uses the current global Contacts API (`POST /contacts`) with a `segments`
 * array — the Audiences API this originally targeted is deprecated in favour
 * of Segments (https://resend.com/docs/api-reference/contacts/create-contact).
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

  try {
    const res = await fetch(CONTACTS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: params.email,
        ...splitName(params.name),
        segments: [segmentId],
      }),
      signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
    });

    // Always consume the body so undici can reuse the connection.
    const body = await res.text();

    if (res.ok) {
      logInfo("Contact added to Resend segment", { email: params.email });
      return true;
    }

    // Contact already exists — treat as success, the user is a contact.
    if (res.status === 409 || /already/i.test(body)) {
      logInfo("Contact already present in Resend", { email: params.email });
      return true;
    }

    logError(
      new Error(`Resend contacts.create failed: ${res.status} ${body}`),
      "Failed to add contact to Resend segment",
      { email: params.email },
    );
    return false;
  } catch (error) {
    logError(error, "Failed to add contact to Resend segment", {
      email: params.email,
    });
    return false;
  }
}
