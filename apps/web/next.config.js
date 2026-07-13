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
  // Serve the static Blume docs site (in public/docs) at /docs. Its pages are
  // written as directory index.html files, so extensionless/clean URLs need to
  // map onto the index.html. These run in `afterFiles`, i.e. only when no real
  // file matched — so real assets like /docs/_astro/*, /docs/og/*, and
  // /docs/robots.txt are served directly and never rewritten.
  async rewrites() {
    return {
      afterFiles: [
        { source: "/docs", destination: "/docs/index.html" },
        { source: "/docs/:path*", destination: "/docs/:path*/index.html" },
      ],
    };
  },
};

export default nextConfig;
