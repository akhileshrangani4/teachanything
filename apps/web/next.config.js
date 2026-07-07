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
};

export default nextConfig;
