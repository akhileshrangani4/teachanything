import { env } from "@/lib/env";
import { logInfo, logWarn, logError } from "@/lib/logger";

// A human waits on the approval mutation, so bound each request tightly.
// AbortSignal.timeout both bounds the latency and aborts the request.
const REQUEST_TIMEOUT_MS = 5_000;

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
 * This must NEVER overwrite an existing contact's `unsubscribed` flag.
 * `POST /contacts` is an upsert that resets omitted fields, so it would
 * silently re-subscribe someone who had opted out. Instead we:
 *   1. add-to-segment (`POST /contacts/{email}/segments/{id}`), which does not
 *      touch `unsubscribed`, and
 *   2. only create the contact (`POST /contacts`) if that returns 404, i.e. the
 *      contact does not exist yet (a brand-new contact is correctly subscribed).
 *
 * Never throws and never rolls back approval: every failure path returns a
 * logged `false`, and the caller commits the approval before calling this. On
 * a hung Resend it blocks for up to REQUEST_TIMEOUT_MS per request, then aborts.
 *
 * Returns true when the contact is in the segment, false when skipped or failed.
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

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const enc = encodeURIComponent(params.email);

  try {
    // 1. Add an existing contact to the segment. Does NOT touch unsubscribed.
    const addRes = await fetch(
      `https://api.resend.com/contacts/${enc}/segments/${segmentId}`,
      {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    const addBody = await addRes.text();

    if (addRes.ok || addRes.status === 409 || /already/i.test(addBody)) {
      logInfo("Contact added to Resend segment", { email: params.email });
      return true;
    }

    // 2. Contact does not exist yet -> create it (new contact is subscribed).
    if (addRes.status === 404) {
      const createRes = await fetch("https://api.resend.com/contacts", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: params.email,
          ...splitName(params.name),
          segments: [{ id: segmentId }],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const createBody = await createRes.text();

      if (createRes.ok) {
        logInfo("Contact created in Resend segment", { email: params.email });
        return true;
      }
      // Raced: created between our add and create -> it's in the segment now.
      if (createRes.status === 409 || /already/i.test(createBody)) {
        return true;
      }
      return logFailure(
        new Error(
          `Resend create contact failed: ${createRes.status} ${createBody}`,
        ),
      );
    }

    return logFailure(
      new Error(`Resend add-to-segment failed: ${addRes.status} ${addBody}`),
    );
  } catch (error) {
    return logFailure(error);
  }
}
