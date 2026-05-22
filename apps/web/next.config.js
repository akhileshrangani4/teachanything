/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    qualities: [75, 90, 95, 100],
  },
  // Externalize server-only extraction packages with native/WASM/runtime assets.
  serverExternalPackages: [
    "@napi-rs/canvas",
    "pdf-parse",
    "pdfjs-dist",
    "tesseract.js",
  ],
  output: "standalone",
};

export default nextConfig;
