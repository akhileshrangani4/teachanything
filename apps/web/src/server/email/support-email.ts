import { env, getAdminEmails } from "@/lib/env";

/**
 * The address professors write to for help: the public contact email, else
 * the first admin. Every notification email's footer and the dashboard's
 * "Contact us" button use it. Server-only, since `ADMIN_EMAILS` is.
 */
export function getAdminContactEmail(): string {
  return (
    env.NEXT_PUBLIC_CONTACT_EMAIL ||
    getAdminEmails()[0] ||
    "no admin email found"
  );
}
