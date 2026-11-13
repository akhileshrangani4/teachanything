/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    qualities: [75, 90, 95, 100],
  },
  // Externalize parsers that can't be bundled. pdf-parse uses Node.js-specific
  // modules; officeparser dynamically requires `file-type` at runtime, which the
  // bundler fails to trace into the function chunk (Cannot find package 'file-type').
  // tesseract.js (image OCR) starts a worker thread from a script path computed
  // from its own __dirname, and @tesseract.js-data/eng reports its model
  // directory the same way; bundled, both paths point at the wrong place.
  serverExternalPackages: [
    "pdf-parse",
    "officeparser",
    "tesseract.js",
    "@tesseract.js-data/eng",
  ],
  output: "standalone",
  // Image OCR runs tesseract.js on a worker thread. Output tracing follows the
  // main-thread code but not the worker script, its requires, or the files it
  // loads by computed path -- and it does not trace the requires of files
  // listed here either. Without each entry below the standalone build lacks a
  // piece and every image upload fails (each was verified by removing it).
  // Listed for the one route that runs file processing in production; the
  // inline paths in finalize-upload, retry and reprocess are development-only.
  //
  // All six engine builds are listed, not just the LSTM ones image-ocr.ts asks
  // for: tesseract.js 7.0.0 passes a boolean where its Node core loader expects
  // an OEM code, so in Node it always loads a full build (plain, SIMD or
  // relaxed-SIMD, chosen by CPU feature at runtime). The route grows by ~60 MB:
  // engine ~44 MB, model data ~14 MB. ~24 MB of the engine is browser-only
  // `.wasm.js` files that end up in the trace even with a glob that excludes
  // them; where they come from is not yet known.
  outputFileTracingIncludes: {
    "/api/jobs/process-file": [
      "../../node_modules/tesseract.js/src/**/*",
      "../../node_modules/tesseract.js-core/package.json",
      "../../node_modules/tesseract.js-core/tesseract-core*",
      "../../node_modules/@tesseract.js-data/eng/4.0.0_best_int/*",
      "../../node_modules/wasm-feature-detect/**/*",
      "../../node_modules/zlibjs/**/*",
      "../../node_modules/bmp-js/**/*",
    ],
  },
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
