/**
 * Resend Audience Backfill Script
 *
 * One-time backfill: pushes every already-approved user into the Resend
 * audience configured via RESEND_AUDIENCE_ID. Safe to re-run -- Resend
 * deduplicates contacts by email within an audience.
 *
 * Usage:
 *   npx tsx packages/db/scripts/backfill-resend-audience.ts
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

const databaseUrl = process.env.DATABASE_URL;
const resendApiKey = process.env.RESEND_API_KEY;
const audienceId = process.env.RESEND_AUDIENCE_ID;

if (!databaseUrl || !resendApiKey || !audienceId) {
  console.error(
    "DATABASE_URL, RESEND_API_KEY and RESEND_AUDIENCE_ID must be set",
  );
  process.exit(1);
}

// Resend's API allows 2 requests/second -- stay under it
const REQUEST_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function backfill() {
  const sql = postgres(databaseUrl!);

  try {
    const users = await sql<{ email: string; name: string | null }[]>`
      SELECT email, name FROM "user" WHERE status = 'approved'
    `;

    console.log(`Found ${users.length} approved users to sync`);

    let synced = 0;
    let failed = 0;

    for (const [i, u] of users.entries()) {
      const res = await fetch(
        `https://api.resend.com/audiences/${audienceId}/contacts`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: u.email,
            first_name: u.name ?? undefined,
            unsubscribed: false,
          }),
        },
      );

      if (res.ok) {
        synced++;
        console.log(`[${i + 1}/${users.length}] synced ${u.email}`);
      } else {
        failed++;
        const body = await res.text();
        console.error(
          `[${i + 1}/${users.length}] FAILED ${u.email}: ${res.status} ${body}`,
        );
      }

      if (i < users.length - 1) await sleep(REQUEST_DELAY_MS);
    }

    console.log(`Done: ${synced} synced, ${failed} failed`);
    if (failed > 0) process.exit(1);
  } finally {
    await sql.end();
  }
}

backfill();
