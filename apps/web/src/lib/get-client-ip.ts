/**
 * Derive the client IP from request headers in a way that resists
 * spoofing.
 *
 * The leftmost entry of `X-Forwarded-For` is whatever the *client* sent
 * — fully attacker-controlled — so using it for rate-limit bucketing lets
 * a caller mint unlimited buckets just by rotating the header. Behind a
 * trusted proxy/edge (Vercel, nginx, etc.) the platform *appends* the
 * real peer IP to XFF, so the **rightmost** entry is the trustworthy one.
 * Vercel additionally sets `x-real-ip` to the true client IP, which is
 * the most reliable source when present.
 *
 * Resolution order:
 *   1. `x-real-ip` (single value the edge sets to the true client IP)
 *   2. rightmost `x-forwarded-for` hop (the edge-appended entry)
 *   3. `"unknown"` fallback so callers always get a stable string
 *
 * NOTE: this is correct for deployments behind a single trusted hop
 * (the default on Vercel). Self-hosted setups with multiple proxies may
 * need to skip N trailing hops; revisit if that becomes a deployment
 * target.
 */
export function getTrustedClientIp(headers: {
  get(name: string): string | null;
}): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const hops = forwardedFor
      .split(",")
      .map((hop) => hop.trim())
      .filter((hop) => hop.length > 0);
    const rightmost = hops[hops.length - 1];
    if (rightmost) return rightmost;
  }

  return "unknown";
}
