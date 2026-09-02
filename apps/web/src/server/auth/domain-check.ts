import { APIError } from "better-auth";
import { db } from "@teachanything/db";
import * as schema from "@teachanything/db/schema";
import { getApprovedDomains } from "@/lib/env";
import { logInfo, logError } from "@/lib/logger";

/**
 * Check if email domain is in allowed list before a user record is created.
 * Throws Better Auth's APIError for proper error messaging when rejected.
 */
export async function enforceAllowedDomain(user: { email: string }) {
  // Check if email domain is in allowed list
  const emailDomain = user.email.substring(user.email.lastIndexOf("@"));
  const allowedDomains = getApprovedDomains();

  // Also check database for allowed domains
  const dbDomains = await db.select().from(schema.approvedDomains);
  const allAllowedDomains = [
    ...allowedDomains,
    ...dbDomains.map((d) => d.domain),
  ];

  const isAllowedDomain = allAllowedDomains.some((domain) =>
    emailDomain.endsWith(domain),
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
