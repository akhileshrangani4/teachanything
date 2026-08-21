import { describe, it, expect } from "@jest/globals";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { resolve } from "node:path";

const run = promisify(execFile);
// Jest runs with cwd at the package root (apps/web), per the repo's test setup.
const REPO_ROOT = resolve(process.cwd(), "../..");
const RAG_SERVICE = resolve(REPO_ROOT, "packages/ai/src/rag-service.ts");

/**
 * `extractPDF` must not import the `pdf-parse` package ROOT.
 *
 * pdf-parse@1.1.1's index.js decides it is in debug mode when `module.parent`
 * is falsy -- which is always, under ESM -- and then synchronously reads
 * `./test/data/05-versions-space.pdf` relative to the process CWD. That fixture
 * only exists inside the package, so unless the server happens to be running
 * from node_modules/pdf-parse the read misses and the import throws ENOENT
 * before any upload is touched -- every pdf failing to process. Verified
 * against a real `output: "standalone"` build run from its own directory.
 *
 * Jest cannot see this directly: its CJS interop gives `module.parent` a value,
 * so the debug block stays off and a root import looks fine here while failing
 * in production. So the check runs in a real Node ESM process instead, and the
 * specifier is read out of the source rather than hardcoded -- reverting
 * `extractPDF` to the package root fails this test.
 */
describe("pdf-parse import", () => {
  const source = readFileSync(RAG_SERVICE, "utf8");
  const specifier = source.match(
    /const pdfParse = \(await import\("([^"]+)"\)\)\.default;/,
  )?.[1];

  it("imports a specifier that is not the crash-prone package root", () => {
    expect(specifier).toBeDefined();
    expect(specifier).not.toBe("pdf-parse");
  });

  it("loads in a bare Node ESM process, the way the server loads it", async () => {
    const probe = `
      const mod = await import(${JSON.stringify(specifier)});
      const fn = mod.default ?? mod;
      if (typeof fn !== "function") throw new Error("not callable: " + typeof fn);
      console.log("LOADED");
    `;
    // cwd is the repo root, as on the server -- and NOT the pdf-parse package
    // directory, which is what makes the debug-mode read fail.
    const { stdout } = await run("node", ["--input-type=module", "-e", probe], {
      cwd: REPO_ROOT,
    });
    expect(stdout).toContain("LOADED");
  }, 60000);
});
