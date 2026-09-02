/**
 * @fileoverview Domain Validation for Email Allowlist
 *
 * Validates domains for academic platform's email allowlist.
 *
 * KEY DISTINCTION:
 * - Broad patterns (.com, .ai) → Blocked (too permissive)
 * - Specific domains (gmail.com, vercel.ai) → Allowed (specific enough)
 * - Educational TLDs (.edu, .ac.uk) → Allowed (200+ supported)
 * - Country TLDs (.de, .fr) → Allowed (for international reach)
 */
import { parse, getPublicSuffix } from "tldts";
import {
  SAFE_EDUCATIONAL_TLDS,
  BLOCKED_GENERIC_TLDS,
} from "./domain-validation/tld-lists";

export {
  SAFE_EDUCATIONAL_TLDS,
  BLOCKED_GENERIC_TLDS,
} from "./domain-validation/tld-lists";

/**
 * Normalizes a domain by removing leading dot if present.
 * Used to check against SAFE_EDUCATIONAL_TLDS in canonical form.
 */
function normalizeDomain(domain: string): string {
  return domain.startsWith(".") ? domain.slice(1) : domain;
}

export type DomainValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Validates a domain for the email allowlist.
 *
 * @param domain - Domain to validate (e.g., ".edu", "gmail.com", ".de")
 * @returns `{ valid: true }` or `{ valid: false, reason: string }`
 *
 * @example
 * validateDomainForAllowlist(".edu")      // ✅ Educational TLD
 * validateDomainForAllowlist("gmail.com") // ✅ Specific domain
 * validateDomainForAllowlist(".com")      // ❌ Broad pattern blocked
 */
export function validateDomainForAllowlist(
  domain: string,
): DomainValidationResult {
  const trimmedDomain = domain.trim().toLowerCase();

  // Basic domain format validation
  const domainRegex =
    /^\.?[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
  if (!domainRegex.test(trimmedDomain)) {
    return { valid: false, reason: "Invalid domain format" };
  }

  // Normalize domain (strip leading dot) for consistent checking
  const normalizedDomain = normalizeDomain(trimmedDomain);

  // Safe educational TLDs are always allowed
  if (SAFE_EDUCATIONAL_TLDS.includes(normalizedDomain)) {
    return { valid: true };
  }

  // Parse domain using Public Suffix List
  const parsed = parse(normalizedDomain);
  const publicSuffix = getPublicSuffix(normalizedDomain);

  // Check if input is only a TLD (e.g., ".com" vs "gmail.com")
  if (publicSuffix && normalizedDomain === publicSuffix) {
    // Block broad commercial TLDs (.com, .net, .org)
    if (BLOCKED_GENERIC_TLDS.includes(publicSuffix)) {
      return {
        valid: false,
        reason: `"${trimmedDomain}" is too broad. Please add specific domains instead (e.g., "gmail.com" not "${trimmedDomain}")`,
      };
    }
    // Allow country TLDs (.de, .fr) and other non-commercial TLDs
    return { valid: true };
  }

  // Specific domains (gmail.com, vercel.ai) are always allowed

  // If parsed domain is null or invalid, reject it
  if (!parsed.domain) {
    return { valid: false, reason: "Invalid domain name" };
  }

  return { valid: true };
}
