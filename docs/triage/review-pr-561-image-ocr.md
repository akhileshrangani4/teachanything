> Code review: teachanything PR #561 (image OCR, phase 1).
> Exported from the Obvious project _Teachanything Issue Triage_ on 2026-11-17. Source: `art_op2G33Hq`.

# Code review — akhileshrangani4/teachanything#561 — feat(files): add OCR for image uploads (phase 1 of #126)

**Readiness:** CLEAN (no Blocker or High findings). One Medium, non-blocking.
**lastReviewedHeadSha:** `5315f2eb7a2f3e3479c13dc5c03e75a54529e611` · **passCount:** 1
**Classification:** COMPLEX (42 files, +1,593/−31). Not resilience-sensitive (no auth, payments, schema or migration).
**Scope:** reviewed against the PR's own description and spec D1 (`art_A0nxwvUW`). Only real defects block: build, type or test failure, security, data loss. The documented limitations are acknowledged deviations and are not findings: corrupt-model init hang, JPEG-only EXIF orientation, English only, browser WASM in the bundle.

## Verification run (local, Node 24.22.3, head `5315f2e`)

| Check                                                                                                                                                               | Result                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `npm run check-types`                                                                                                                                               | pass                                                                                                                     |
| `npm run lint`                                                                                                                                                      | pass                                                                                                                     |
| `npm run test`                                                                                                                                                      | pass: db 32/32 (4 suites), ai 173/173 (13 suites), web 1,127/1,127 (82 suites)                                           |
| `npm run format:check`                                                                                                                                              | pass                                                                                                                     |
| OCR suites with the network disabled (`unshare -rn`; a `curl` probe confirmed no network): `image-ocr`, `image-orientation`, `image-dimensions`, `image-ocr-engine` | 4 suites, 88/88 pass                                                                                                     |
| GitHub CI on the head: `build`, `test`, `validate-pr-title`, GitGuardian, codecov/patch                                                                             | all pass. The Vercel check fails with "Authorization required to deploy" (fork deploy authorization), not a code failure |

The test counts match the PR description exactly.

## File Health Report

| File                                                                                                                  | Lines  | Health  | Notes                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------- | ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/ai/src/image-ocr.ts`                                                                                        | 177    | 🟢 Good | Small, pure validation (`assertImageIsProcessable`) separated from the worker lifecycle. The deadline terminates the worker on every path where tesseract.js hands one back. The comments explain why. |
| `packages/ai/src/image-orientation.ts`                                                                                | 120    | 🟢 Good | Pure functions, bounds-checked, and never throws (the try/catch maps truncated EXIF to "no rotation"). Never mutates input.                                                                            |
| `packages/ai/src/image-dimensions.ts`                                                                                 | 163    | 🟢 Good | Header-only reads guard against decompression bombs before any decoder runs. Each reader is pure and returns `null` on malformed input.                                                                |
| `packages/ai/src/file-signature.ts`                                                                                   | +30/−5 | 🟢 Good | The `null` wildcard for the RIFF size field is minimal and typed. Images are added to `BINARY_CONTAINERS`, so a text upload that is really an image is rejected.                                       |
| `packages/ai/src/rag-service.ts`                                                                                      | +26    | 🟢 Good | `extractImage` mirrors `extractWord`, and empty OCR output throws a clear error.                                                                                                                       |
| `apps/web/src/lib/processing-error.ts`                                                                                | +43    | 🟢 Good | Image errors are matched before the generic branches, which avoids contradictory "run it through OCR" advice. The server path is kept out of the user message.                                         |
| `apps/web/next.config.js`                                                                                             | +35    | 🟡 Fair | Tracing includes are justified line by line. The extra ~24 MB of browser WASM is a documented limitation.                                                                                              |
| `apps/web/src/server/routers/files/validation.ts`, `file-constants.ts`, `UploadFileDialog.tsx`, `use-upload-queue.ts` | small  | 🟢 Good | The client and server lists agree. The `accept` attribute now derives from `ALLOWED_EXTENSIONS` instead of a hand-copied string.                                                                       |

## Security and performance notes (no findings)

- **Untrusted input:** the image buffer is signature-checked, dimension-checked (30 MP cap) and rejected for multi-page TIFF before any decoder runs. The OCR runs locally, so the image never leaves the server. No CDN fetch happens at runtime (`cacheMethod: "none"`, local `langPath`), which the offline test run confirmed.
- **Process safety:** `errorHandler: () => {}` keeps a per-job failure from becoming an uncaught exception in tesseract's message listener. The rejection still reaches the awaiting caller. This is intentional and documented.
- **CPU:** the 45 s OCR deadline sits under the pipeline's 60 s `EXTRACTION_TIMEOUT_MS` (`pipeline.ts:19`) and terminates the worker thread.

## Findings

🟡 **MEDIUM**: A worker terminate failure is swallowed silently

`packages/ai/src/image-ocr.ts:175`

```ts
await state.worker?.terminate().catch(() => {});
```

If `terminate()` rejects, a worker thread may still be alive and burning CPU, and nothing records it. AGENTS.md §"Fail fast" says "no silent failures", and the package already logs recoverable problems through `@teachanything/logger` (`rag-service.ts` uses `logWarn`). Cleanup must not mask the primary result, so swallowing it is right. It should leave a trace, though. Line 144 (terminating a worker that started after the timeout) has no catch, so its rejection lands in `work.catch(() => {})` on line 153 and is also invisible.

**Suggestion:**

```ts
import { logWarn } from "@teachanything/logger";
// ...
await state.worker?.terminate().catch((error: unknown) =>
  logWarn("OCR worker failed to terminate", {
    error: error instanceof Error ? error.message : String(error),
  }),
);
```

The existing test "still returns the text when terminating the worker fails" can assert one `logWarn` call through `jest.unstable_mockModule("@teachanything/logger", …)`.

## Spec compliance (D1)

D1 asks for a review and a merge, not new code in the PR. The PR's scope matches its description: image OCR only, "Part of #126", no scanned-PDF work. Nothing is missing against the PR's own stated scope.
