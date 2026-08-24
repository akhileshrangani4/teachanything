// Copies the built Blume docs site into the web app's public folder so the
// main Next.js app serves it at /docs.
//
// The docs are built with `deployment.base: "/docs"`, meaning every page and
// asset URL is already prefixed with /docs. We mount the whole `dist/` under
// `public/docs`, so a page at `dist/instructors/index.html` becomes
// `public/docs/instructors/index.html` and resolves at /docs/instructors.
//
// Under `turbo run build`, the `docs` package is built first (web depends on
// it), so `apps/docs/dist` already exists and we just copy it. For a bare
// `next build` outside Turbo, we build the docs here as a fallback.
import { spawnSync } from "node:child_process";
import { cp, rm, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import process from "node:process";

const here = dirname(fileURLToPath(import.meta.url));
const docsDir = resolve(here, "../../docs");
const distDir = resolve(docsDir, "dist");
const outDir = resolve(here, "../public/docs");

const distExists = await access(distDir).then(
  () => true,
  () => false,
);

if (!distExists) {
  console.log("[embed-docs] No docs build found; building it now...");
  const build = spawnSync("npx", ["blume", "build"], {
    cwd: docsDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (build.status !== 0) {
    console.error("[embed-docs] Docs build failed.");
    process.exit(build.status ?? 1);
  }
}

await rm(outDir, { recursive: true, force: true });
await cp(distDir, outDir, { recursive: true });
console.log(`[embed-docs] Copied docs site into ${outDir}`);
