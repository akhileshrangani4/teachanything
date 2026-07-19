/**
 * Resend Segment Backfill Script
 *
 * One-time backfill: pushes every already-approved user into the Resend
 * segment configured via RESEND_SEGMENT_ID, using the current global Contacts
 * API (POST /contacts with a `segments` array). The Audiences API is
 * deprecated in favour of Segments.
 *
 * Safe to re-run: it never removes contacts and omits `unsubscribed`, so an
 * existing opt-out is never overwritten, and contacts already present (HTTP
 * 409 / an "already" response) are counted separately rather than as
 * failures, so a clean re-run exits 0.
 *
 * Usage:
 *   npx tsx packages/db/scripts/backfill-resend-segment.ts
 *   npx tsx packages/db/scripts/backfill-resend-segment.ts --dry-run
 *
 * With --dry-run it reads the approved users and prints exactly what it would
 * POST to Resend, without making any requests. Only DATABASE_URL is required
 * in that mode (RESEND_API_KEY / RESEND_SEGMENT_ID are not needed).
 */

import postgres from "postgres";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from apps/web/.env
const envPath = resolve(__dirname, "../../../apps/web/.env");
const result = config({ path: envPath });

if (result.error) {
  console.error("Error loading .env file:", result.error);
  process.exit(1);
}

const isDryRun = process.argv.includes("--dry-run");

const databaseUrl = process.env.DATABASE_URL;
const resendApiKey = process.env.RESEND_API_KEY;
const segmentId = process.env.RESEND_SEGMENT_ID;

// A dry run only needs the DB to read the user list; it never calls Resend.
if (!databaseUrl || (!isDryRun && (!resendApiKey || !segmentId))) {
  console.error(
    isDryRun
      ? "DATABASE_URL must be set"
      : "DATABASE_URL, RESEND_API_KEY and RESEND_SEGMENT_ID must be set",
  );
  process.exit(1);
}

// In a dry run RESEND_SEGMENT_ID may be unset; show a placeholder so the
// printed payload is still readable.
const segmentIdForPayload = segmentId ?? "<RESEND_SEGMENT_ID>";

// Resend's documented default rate limit is 10 requests/second per team --
// stay well under it to leave room for concurrent app traffic
const REQUEST_DELAY_MS = 250;

// Node's fetch has no overall deadline; bound each request so one hung
// connection can't stall the serial loop
const REQUEST_TIMEOUT_MS = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// The user schema stores a single `name`; split it into Resend's
// first_name/last_name on whitespace (first token first, the rest last).
function splitName(name: string | null): {
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

async function backfill() {
  const sql = postgres(databaseUrl!);

  try {
    const users = await sql<{ email: string; name: string | null }[]>`
      SELECT email, name FROM "user" WHERE status = 'approved'
    `;

    console.log(
      `Found ${users.length} approved users to sync${isDryRun ? " (dry run — no requests will be made)" : ""}`,
    );

    let synced = 0;
    let alreadyPresent = 0;
    let failed = 0;

    for (const [i, u] of users.entries()) {
      // Payload sent to POST /contacts (segments takes an array of { id }).
      const payload = {
        email: u.email,
        ...splitName(u.name),
        segments: [{ id: segmentIdForPayload }],
      };

      if (isDryRun) {
        synced++;
        console.log(
          `[${i + 1}/${users.length}] would create ${JSON.stringify(payload)}`,
        );
        continue;
      }

      try {
        const res = await fetch("https://api.resend.com/contacts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        // Always consume the body so undici can reuse the connection
        const body = await res.text();

        if (res.ok) {
          synced++;
          console.log(`[${i + 1}/${users.length}] synced ${u.email}`);
        } else if (res.status === 409 || /already/i.test(body)) {
          // Contact already present — expected on a re-run, not a failure, so
          // it doesn't set a nonzero exit code.
          alreadyPresent++;
          console.log(`[${i + 1}/${users.length}] already present ${u.email}`);
        } else {
          failed++;
          console.error(
            `[${i + 1}/${users.length}] FAILED ${u.email}: ${res.status} ${body}`,
          );
        }
      } catch (error) {
        failed++;
        console.error(`[${i + 1}/${users.length}] FAILED ${u.email}:`, error);
      }

      if (i < users.length - 1) await sleep(REQUEST_DELAY_MS);
    }

    if (isDryRun) {
      console.log(`Dry run: would sync ${synced} contacts. No requests made.`);
      return;
    }

    console.log(
      `Done: ${synced} synced, ${alreadyPresent} already present, ${failed} failed`,
    );
    // exitCode (not process.exit) so the finally block still runs. Only real
    // failures fail the run — a clean re-run (all already present) exits 0.
    if (failed > 0) process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

backfill().catch((error) => {
  console.error("Backfill failed:", error);
  process.exitCode = 1;
});
