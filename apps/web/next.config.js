/** @typedef {{ key: string; value: string }} HeaderEntry */

/** Sent on every response, including embeds. @type {HeaderEntry[]} */
export const BASELINE_SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Deliberately short, without includeSubDomains/preload, so a bad HTTPS
  // rollout on any subdomain can't lock users out for long.
  { key: "Strict-Transport-Security", value: "max-age=86400" },
];

/**
 * Forbids every site (including our own) from framing the page. CSP
 * frame-ancestors is the modern control; X-Frame-Options covers old browsers.
 * @type {HeaderEntry[]}
 */
export const FRAME_DENY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
];

// Paths that must stay frameable or that own their framing policy:
// - /embed/* and /chat/* are iframed by LMS pages on third-party origins.
// - /api/files/:fileId/download sets its own X-Frame-Options; config headers
//   are applied first and would otherwise win over the handler's value.
// `(?:/|$)` keeps siblings such as /chatbot/* under the deny rule.
const FRAMING_EXEMPT_PATHS = [
  "embed(?:/|$)",
  "chat(?:/|$)",
  "api/files/[^/]+/download(?:/|$)",
].join("|");

/** @type {import('next').NextConfig["headers"]} */
export async function securityHeaders() {
  return [
    { source: "/:path*", headers: BASELINE_SECURITY_HEADERS },
    {
      source: `/((?!${FRAMING_EXEMPT_PATHS}).*)`,
      headers: FRAME_DENY_HEADERS,
    },
    // proxy.ts rewrites admin.<host>/<path> to /admin/<path>, but headers are
    // matched against the incoming path, so admin.<host>/chat/... would slip
    // through the exemption above. Deny framing for the whole admin host.
    {
      source: "/:path*",
      has: [{ type: "host", value: "admin\\..+" }],
      headers: FRAME_DENY_HEADERS,
    },
  ];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    qualities: [75, 90, 95, 100],
  },
  // Externalize parsers that can't be bundled. pdf-parse uses Node.js-specific
  // modules; officeparser dynamically requires `file-type` at runtime, which the
  // bundler fails to trace into the function chunk (Cannot find package 'file-type').
  serverExternalPackages: ["pdf-parse", "officeparser"],
  output: "standalone",
  headers: securityHeaders,
  // The docs have no landing page; send /docs straight into the first guide
  // with a real HTTP redirect (a Blume meta-refresh page would flash
  // "Redirecting to…" first). Redirects run before rewrites, so this wins.
  async redirects() {
    return [
      { source: "/docs", destination: "/docs/instructors", permanent: false },
    ];
  },
  // Serve the static Blume docs site (in public/docs) at /docs. Its pages are
  // written as directory index.html files, so extensionless/clean URLs need to
  // map onto the index.html. These run in `afterFiles`, i.e. only when no real
  // file matched — so real assets like /docs/_astro/*, /docs/og/*, and
  // /docs/robots.txt are served directly and never rewritten.
  async rewrites() {
    return {
      afterFiles: [
        { source: "/docs/:path*", destination: "/docs/:path*/index.html" },
      ],
    };
  },
};

export default nextConfig;
