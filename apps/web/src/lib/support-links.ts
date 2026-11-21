/**
 * Where professors and visitors can support Teach Anything. Client-safe: the
 * env var is read as a literal `process.env.NEXT_PUBLIC_*` access so Next.js
 * inlines it into the browser bundle.
 */
export const DEFAULT_DONATION_URL =
  "https://www.gofundme.com/f/empower-educators-with-openaccess-ai";

/** The donation page: `NEXT_PUBLIC_DONATION_URL`, else the GoFundMe page. */
export function getDonationUrl(): string {
  return process.env.NEXT_PUBLIC_DONATION_URL || DEFAULT_DONATION_URL;
}
