import { APIError } from "better-auth";
import { db } from "@teachanything/db";
import * as schema from "@teachanything/db/schema";
import { getApprovedDomains } from "@/lib/env";
import { logInfo, logError } from "@/lib/logger";

/**
 * Does `emailDomain` (the host after the "@", lowercased) satisfy one
 * allowlist entry?
 *
 * Entries arrive in several shapes, because both the env var and the admin UI
 * accept what a human would naturally type:
 *
 *   "@gwu.edu" / "gwu.edu"  a specific institution: that host, or a subdomain
 *                           of it. NOT a lookalike that merely ends the same
 *                           way.
 *   ".edu" / "edu"          a TLD wildcard: any host under it.
 *
 * The old check was a bare `emailDomain.endsWith(entry)` against the domain
 * WITH its leading "@". That anchored correctly for "@gwu.edu", but an entry
 * written without the "@" also matched "evil-gwu.edu", letting an attacker
 * register on a lookalike domain. Matching now happens on a label boundary.
 */
export function matchesAllowedDomain(
  emailDomain: string,
  entry: string,
): boolean {
  const normalized = entry.trim().toLowerCase().replace(/^@/, "");
  if (!normalized) return false;

  // A leading dot (or a bare TLD) means "anything under this suffix".
  if (normalized.startsWith(".")) return emailDomain.endsWith(normalized);
  if (!normalized.includes(".")) return emailDomain.endsWith(`.${normalized}`);

  // A specific domain: the host itself, or a subdomain of it.
  return emailDomain === normalized || emailDomain.endsWith(`.${normalized}`);
}

/**
 * Check if email domain is in allowed list before a user record is created.
 * Throws Better Auth's APIError for proper error messaging when rejected.
 */
export async function enforceAllowedDomain(user: { email: string }) {
  // Check if email domain is in allowed list
  const emailDomain = user.email
    .substring(user.email.lastIndexOf("@") + 1)
    .toLowerCase();
  const allowedDomains = getApprovedDomains();

  // Also check database for allowed domains
  const dbDomains = await db.select().from(schema.approvedDomains);
  const allAllowedDomains = [
    ...allowedDomains,
    ...dbDomains.map((d) => d.domain),
  ];

  const isAllowedDomain = allAllowedDomains.some((domain) =>
    matchesAllowedDomain(emailDomain, domain),
  );

  // If domain not allowed and list is not empty, reject registration
  if (allAllowedDomains.length > 0 && !isAllowedDomain) {
    logError(
      new Error("Unauthorized domain"),
      "Registration blocked for unauthorized domain",
      {
        email: user.email,
        domain: emailDomain,
      },
    );
    // Use Better Auth's APIError for proper error messaging
    throw new APIError("BAD_REQUEST", {
      message:
        "This email domain is not authorized for registration. Please contact an administrator if you believe this is an error.",
    });
  }

  logInfo("Domain check passed for new user", {
    email: user.email,
  });
}
