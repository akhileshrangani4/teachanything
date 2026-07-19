/**
 * Resend Segment Backfill Script
 *
 * One-time backfill: puts every already-approved user into the Resend segment
 * configured via RESEND_SEGMENT_ID.
 *
 * IMPORTANT — this must never overwrite an existing contact's `unsubscribed`
 * flag. `POST /contacts` is an UPSERT: for an existing contact it resets
 * omitted fields to their defaults, so it would silently re-subscribe anyone
 * who had opted out. Instead, for each user we:
 *   1. POST /contacts/{email}/segments/{segmentId}  (add-to-segment) — this
 *      adds an existing contact to the segment and does NOT touch
 *      `unsubscribed`.
 *   2. Only if that returns 404 (contact does not exist yet) do we
 *      POST /contacts to create a brand-new contact (subscribed by default,
 *      which is correct for someone who was never a contact).
 *
 * Safe to re-run: it never removes contacts and never resets `unsubscribed`;
 * a contact already in the segment is counted, not failed.
 *
 * Usage:
 *   npx tsx packages/db/scripts/backfill-resend-segment.ts
 *   npx tsx packages/db/scripts/backfill-resend-segment.ts --dry-run
 *
 * With --dry-run it reads the approved users and prints what it would send,
 * without making any requests. Only DATABASE_URL is required in that mode
 * (RESEND_API_KEY / RESEND_SEGMENT_ID are not needed).
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
// printed payload is still readable. In a real run this is always the real id.
const seg = segmentId ?? "<RESEND_SEGMENT_ID>";

// Resend's documented default rate limit is 10 requests/second per team --
// stay well under it to leave room for concurrent app traffic
const REQUEST_DELAY_MS = 250;

// Node's fetch has no overall deadline; bound each request so one hung
// connection can't stall the serial loop
const REQUEST_TIMEOUT_MS = 15_000;

const authHeaders = {
  Authorization: `Bearer ${resendApiKey}`,
  "Content-Type": "application/json",
};

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

type SyncResult = "added" | "created" | "failed";

// Add an existing contact to the segment (preserving unsubscribed), or create
// it if it does not exist yet. Never sends `unsubscribed`.
async function syncOne(u: { email: string; name: string | null }): Promise<{
  result: SyncResult;
  detail?: string;
}> {
  const enc = encodeURIComponent(u.email);

  // 1. Add existing contact to the segment. This does NOT touch unsubscribed.
  const addRes = await fetch(
    `https://api.resend.com/contacts/${enc}/segments/${seg}`,
    {
      method: "POST",
      headers: authHeaders,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  const addBody = await addRes.text();

  if (addRes.ok || addRes.status === 409 || /already/i.test(addBody)) {
    return { result: "added" };
  }

  // 2. Contact does not exist yet -> create it. A brand-new contact defaults to
  // subscribed, which is correct for someone who was never a contact.
  if (addRes.status === 404) {
    const createRes = await fetch("https://api.resend.com/contacts", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        email: u.email,
        ...splitName(u.name),
        segments: [{ id: seg }],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const createBody = await createRes.text();
    if (createRes.ok) return { result: "created" };
    // Raced: created between our add and create -> it's in the segment now.
    if (createRes.status === 409 || /already/i.test(createBody)) {
      return { result: "added" };
    }
    return { result: "failed", detail: `${createRes.status} ${createBody}` };
  }

  return { result: "failed", detail: `${addRes.status} ${addBody}` };
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

    let added = 0;
    let created = 0;
    let failed = 0;

    for (const [i, u] of users.entries()) {
      const tag = `[${i + 1}/${users.length}]`;

      if (isDryRun) {
        added++;
        console.log(
          `${tag} would add ${u.email} to segment ${seg} (create if new)`,
        );
        continue;
      }

      try {
        const { result, detail } = await syncOne(u);
        if (result === "added") {
          added++;
          console.log(`${tag} added to segment ${u.email}`);
        } else if (result === "created") {
          created++;
          console.log(`${tag} created ${u.email}`);
        } else {
          failed++;
          console.error(`${tag} FAILED ${u.email}: ${detail}`);
        }
      } catch (error) {
        failed++;
        console.error(`${tag} FAILED ${u.email}:`, error);
      }

      if (i < users.length - 1) await sleep(REQUEST_DELAY_MS);
    }

    if (isDryRun) {
      console.log(`Dry run: would sync ${added} contacts. No requests made.`);
      return;
    }

    console.log(
      `Done: ${created} created, ${added} added to segment, ${failed} failed`,
    );
    // exitCode (not process.exit) so the finally block still runs. Only real
    // failures fail the run — a clean re-run (all already in segment) exits 0.
    if (failed > 0) process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

backfill().catch((error) => {
  console.error("Backfill failed:", error);
  process.exitCode = 1;
});
