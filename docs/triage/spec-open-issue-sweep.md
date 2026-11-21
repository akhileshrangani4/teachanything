> Spec (Blueprint): teachanything open-issue sweep, 17 issues. Converted from the Blueprint HTML (snapshot `725e4f8`, version 11).
> Exported from the Obvious project _Teachanything Issue Triage_ on 2026-11-17. Source: `art_A0nxwvUW`.

_teachanything · open-issue sweep · spec_

# Close out all 17 open teachanything issues

_Seventeen deliverables across the file pipeline, data integrity, test and CI hardening, student ratings, analytics and the four contributor PRs. Each has acceptance criteria and tests. Delivery uses two release branches and independent PRs._

## Problem and decision

_The goal is to resolve every open issue on `akhileshrangani4/teachanything`. Not every issue needs new code. Some are already fixed on `main`. Some already have an open PR that's the right base to build on. Two need a decision from you rather than code._

The research read the code at `origin/main` `ad356f3` (release 1.37.0) for all 17 issues and the four open PRs that address them. The findings are in four documents (`art_z6LepG9f`, `art_ZmzNcvmk`, `art_1lfOk5CU`, `art_ZiqEZVVy`). Every issue fits one of three cases:

- **Real defect or missing feature: build it.** 12 issues, all mapped to deliverables below.
- **Covered by a contributor PR: review and land it.** #126 phase 1 (#561) and #540 (#560). #136 (#340) gets the same treatment if the contributor pushes by Nov 20; otherwise I replace their PR with a new one.
- **No code needed.** #131 is already delivered on `main`. #137 is on hold at your call.

> **What you are approving**
>
> The 17 deliverables below and their acceptance criteria. One design choice shapes most of the file work: **local OCR is the free baseline text for images and scanned PDFs. An open-source vision model via OpenRouter adds descriptions on top of it, behind an on/off toggle, and if vision fails the file keeps its OCR text.**
>
> Delivery: two release branches (`release/file-pipeline`, `release/response-ratings`), the two contributor PRs merged straight to `main`, and every other fix as an independent PR to `main`.

### Owner decisions already made

| Issue                 | Decision                                                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #129 vision           | Switch #550 from direct OpenAI calls to an open-source vision model via OpenRouter, behind an on/off toggle, running after OCR.                                 |
| #126 OCR              | Land contributor PR #561 (images) as their work. Build scanned-PDF OCR (phase 2) as a separate PR, respecting the scope and design #561's description sets out. |
| #137 newsletter       | Not built. Mark the issue on hold.                                                                                                                              |
| #559 ratings          | We build it after #560 lands. Ratings are saved server-side, with no shared-chat session rehydration. The professor's card covers a fixed 30 days.              |
| #540 i18n             | Land #560 as-is after review. The review blocks only on real defects, not on scope.                                                                             |
| #136 emails           | Wait until Nov 20 for the contributor. If there's no push by then, replace #340 with a new PR.                                                                  |
| #464 deletion         | Fail closed: if storage cleanup fails, the deletion aborts and the user retries. No migration.                                                                  |
| #465 concurrent turns | A second turn while one is in flight gets a 409, "a response is already in progress".                                                                           |

### Decisions this spec makes (challenge any of them)

- **#315:** rung 1 only, which is normalization. One small PR with no new infrastructure. Measure before going further.
- **#131:** close it as done, pointing to #305 and #317.
- **#462:** the reworked #550 is where the main fix lands, because it already has the atomic chunk swap. A follow-up PR handles what's left.
- **#480:** delete `checkUserStatus` outright. The issue's `pending | rejected | null` shape would still reveal which accounts exist.

### Non-goals

- The newsletter (#137).
- Shared-chat session rehydration.
- A date-range picker for the whole Analytics tab.
- Moving tests from Jest to Vitest.
- Rungs 2–4 of #315.
- Splitting or trimming #560.
- Vision descriptions for images embedded in text-native PDFs (see Locked decisions).
- The sign-up "already exists" enumeration sibling of #480, which gets its own issue.

## What I read

All line numbers refer to `origin/main` `ad356f3` unless they name a PR head. Each row records what I learned and how it changed this spec.

| Read                                                                                                                  | Learned                                                                                                                                                                                                                                                                                                                                                                                                                 | Effect on the spec                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `file-processor/pipeline.ts:49-80, 168-229`                                                                           | The claim overwrites the metadata. Chunks are deleted before their replacements exist. A failure deletes the chunks again and marks the file `failed`.                                                                                                                                                                                                                                                                  | #462 is real. It needs an atomic swap and must keep a file `completed` when a refresh fails.                                                   |
| PR #550 head `694e570` (`file-index-storage.ts`, `visual-analysis.ts`)                                                | It already has the transactional `replaceFileIndex`, a version skip and `refreshWarning`. Its vision calls go to `api.openai.com/v1/responses` with `gpt-6-sol`. It has no toggle. A vision failure fails the whole file. Images are sent to vision before OCR.                                                                                                                                                         | Keep #550's scaffolding and replace the provider layer and the routing (D2).                                                                   |
| `git merge-tree` of #550 vs #561                                                                                      | The two PRs conflict in 9 files. With #550's routing, #561's OCR never runs on PNG, JPEG or WebP.                                                                                                                                                                                                                                                                                                                       | #561 lands first, and #550 is rebuilt on top of it.                                                                                            |
| PR #561 description and comments                                                                                      | The PR is "Part of #126", images only: "Scanned-PDF rendering and OCR remain outside this contribution." OCR is local (no CDN) with a 45 s timeout that terminates the worker. Known limitations are documented: worker init can hang on a corrupt model, EXIF orientation is JPEG-only, English only, and the bundle carries extra WASM. The contributor asked how #561 and #550 should coexist and has had no answer. | Land #561 as their work. Phase 2 (D3) builds on `recognizeImageText` without changing its contract. Answer the coexistence question on the PR. |
| `finalize-upload.ts:136-176`, `create-file-record.ts:74-119`                                                          | #533 and #534 already fixed the issue's destructive half. A failed publish still leaves a `pending` row for up to 60 min.                                                                                                                                                                                                                                                                                               | #463 narrows to "mark the row retryable" (D5).                                                                                                 |
| `rag-service.ts:90-111, 238-306`, `validation.ts:7-51`, `file-constants.ts:10-30`, `file-signature.ts:35-55`          | `officeparser` 6.1.0 is already installed and lists RTF. The upload type lists are duplicated in three places.                                                                                                                                                                                                                                                                                                          | RTF (D6) needs no new dependency, and all three lists must change.                                                                             |
| `services/user-deletion.ts:40-83`, `files/procedures/delete.ts:48-63`                                                 | Deletion removes storage before the DB transaction and swallows errors. It also passes crawled URLs to storage remove, deletes nothing in local storage mode, and doesn't batch. `files.delete` already fails closed.                                                                                                                                                                                                   | D7 copies `files.delete`. The test at `user-deletion.test.ts:170` asserts the bug and must be inverted.                                        |
| `stream-chat.ts:86-129, 217-222`, `turn-context.ts:45-51`, `useChat.ts:18-22, 59`                                     | History is read before the user row exists. Messages have no sequence column. The client mints a new session id on every page load and blocks sending while a reply streams.                                                                                                                                                                                                                                            | D8 is a compare-and-set marker for the turn in flight. The impact shows up in the professor's transcripts and exports.                         |
| `routers/auth/procedures/status.ts:42-73`, `session-gate.ts:42-60`, `login/page.tsx:66-106`                           | Anonymous callers get the raw account status. The session gate already reports pending and rejected accounts once the password checks out.                                                                                                                                                                                                                                                                              | Delete the procedure and the login fallback (D9).                                                                                              |
| Jest runs with and without `--experimental-vm-modules` (executed)                                                     | With the flag, all 95 suites and 1,209 tests pass. Without it, 23 web suites fail. In ESM mode `jest.mock` has no effect, which a probe confirmed. `rate-limit.test.ts` and `files-validation.test.ts` pass only by coincidence.                                                                                                                                                                                        | #399 is a docs, guard and two-suite fix (D10), not a Vitest move.                                                                              |
| Drift prototype against local PG17 + pgvector (executed)                                                              | Clean DB: 17/17 tables, exit 0. After dropping a column it reported `account.scope` missing, exit 1. `db:migrate` fails on an empty DB because of the index order in `setup-extensions.sql`.                                                                                                                                                                                                                            | The approach in D11 is proven. #560 carries the fresh-DB fix (`setup-indexes.sql`).                                                            |
| `recover-quiz.ts:49-306`, `primary-turn.ts:185-186, 294-330`                                                          | Quiz recovery is on `main`, but it never logs and the no-tools fallback turn skips it.                                                                                                                                                                                                                                                                                                                                  | D12 adds logging that includes `modelId` and covers the fallback turn.                                                                         |
| PR #560 file list and checks                                                                                          | 256 files, +13.3k lines. Required CI passes. It adds migration `0021_user_preferred_locale`, hard-codes Lingo.dev IDs and changes the chat API error format to `{ "code" }`. GitGuardian flags 2 findings that look like false positives.                                                                                                                                                                               | Land it as-is. Later PRs that add strings or chat errors follow its conventions.                                                               |
| PR #340 review (owner CHANGES_REQUESTED, 2026-09-16)                                                                  | 3 blockers, 7 fixes and 5 nits, all unaddressed. The branch conflicts in 4 files. Its migration must be regenerated in a slot after 0021.                                                                                                                                                                                                                                                                               | D16's acceptance criterion is the review itself, whoever ships it.                                                                             |
| `insights.ts:9-77`, `AnalyticsTab.tsx:33-160`, `usage.ts`, `sessions.ts`                                              | Every acceptance criterion in #131 is met. Common questions are grouped by `lower(trim())` and cover all time.                                                                                                                                                                                                                                                                                                          | Close #131. #315 rung 1 normalizes before grouping (D15).                                                                                      |
| `study-response/shared/route.ts`, `lib/submit-study-response.ts`, `turn-persistence.ts:137-139`, `stream-chat.ts:241` | There's a pattern for anonymous writes. The client already retries a 404 caused by the race with `onFinish`. The assistant row id is random, so it doesn't match the id that was streamed.                                                                                                                                                                                                                              | D14 makes those ids match and reuses both patterns.                                                                                            |

> **Note:** Two claims come from training knowledge and were not checked: QStash delivers at least once, and Better Auth creates the session only after verifying the password. The acceptance criteria for D4 and D9 include tests that confirm both.

## File pipeline: OCR baseline, vision enrichment, safe jobs

_Covers #126, #129, #462, #463 and #128. Every file follows the same path: extract its text, add OCR text where the file is only pixels, add vision descriptions if they're turned on, then swap in the new chunks in one transaction._

| Input                          | Text extraction            | OCR (local, free)                          | Vision (OpenRouter, toggle)                                | If vision fails or is off           |
| ------------------------------ | -------------------------- | ------------------------------------------ | ---------------------------------------------------------- | ----------------------------------- |
| JPEG/PNG/WebP/TIFF upload      | —                          | `recognizeImageText` (#561)                | Description appended after the OCR text                    | Indexed with OCR text only          |
| Text-native PDF                | `unpdf` (unchanged)        | —                                          | — (non-goal)                                               | Unchanged                           |
| Scanned PDF (no readable text) | `unpdf` finds no text      | Pages rendered, then OCR on each page (D3) | Description for each rendered page, within the cap         | Indexed with OCR text only          |
| DOCX/PPTX with embedded images | `mammoth` / `officeparser` | —                                          | Description for each embedded image, from #550's extractor | Indexed with the document text only |
| RTF (D6)                       | `officeparser`             | —                                          | —                                                          | —                                   |

### D1 — Land #561 (image OCR, phase 1) as the contributor's work

Review #561 against its own description and merge it to `main` under the contributor's authorship. The limitations it lists stay as limitations and don't block the merge. The review blocks only on real defects. One small fix is already known: `void worker.terminate().catch(() => {})` in `image-ocr.ts` swallows the error, and the repo's rule is to log with `logWarn`. Leave that as a review suggestion for the contributor. If they don't respond, push it as a single maintainer commit on their branch (`maintainerCanModify` is true) with a comment that credits them. Before #550's rework lands, reply on #561 with the coexistence decision: OCR is the baseline, vision adds descriptions after it, and #561 merges first.

| Acceptance criterion                                                                                                           | Verified by                                                 |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| #561 merges to `main` with its commits authored by the contributor. The issue stays open because the PR says "Part of #126".   | `gh pr view 561` shows it merged and the authors unchanged. |
| CI is green on the merge commit: check-types, lint, the three test projects and build.                                         | The PR's required checks.                                   |
| The OCR suites pass with the network disabled: `image-ocr`, `image-orientation`, `image-dimensions` and the real-engine tests. | The test logs on the merge commit.                          |
| The coexistence decision is posted on #561, and the contributor is invited to review D3.                                       | A comment on the PR.                                        |

### D2 — Rework #550: OpenRouter vision after OCR, behind a toggle (#129, and the core of #462)

Rebase #550 onto `main` after #561 lands, and keep its index scaffolding: `replaceFileIndex`, the version skip and `refreshWarning`. Replace its provider with the existing `@openrouter/ai-sdk-provider` wiring, and route standalone images through OCR first.

    // packages/ai/src/visual-analysis.ts (shape)
    export interface VisualAnalysisConfig {
      enabled: boolean;            // VISUAL_ANALYSIS_ENABLED, default "true"
      modelId: string;             // VISION_MODEL, an open-weight OpenRouter model with image input
      maxImagesPerFile: number;    // keep #550's caps (e.g. 50 slides) as defaults
      perImageTimeoutMs: number;
    }
    export type VisualResult =
      | { status: "described"; text: string }
      | { status: "skipped"; reason: "disabled" | "cap" }
      | { status: "failed"; error: string };   // never throws into the pipeline

    // pipeline: text = ocrText ?? nativeText; if (vision.status === "described") text += "\n\n[Image description]\n" + vision.text
    // failed  → index the text anyway; metadata.visionWarning = error (shown like refreshWarning)

- **Model:** a single `VISION_MODEL` env var with no hard-coded vendor. At implementation time, pick the default from OpenRouter's `/models` list: open weights, with `image` in `input_modalities`. Record the choice and its price in the PR. `VISION_MODEL` must also be honored in local and preview environments.
- **Toggle:** `VISUAL_ANALYSIS_ENABLED`, defaulting to on as #129 asks. When it's off, the vision module makes no network calls.
- **Reprocessing scope:** the processing version moves to `v3`, but only for file types that gain content: images, DOCX and PPTX. Other types stay current, so turning this on doesn't re-embed every file (`targetProcessingVersion(fileType)`).
- **Timeouts:** the 60 s global extraction timeout stays. Vision gets its own budget within the route's `maxDuration` 300, and #550's change to 180 s is reverted.
- **#462 core:** claiming merges the existing metadata instead of overwriting it. The chunk swap is atomic. A failed refresh leaves the file `completed` with its old chunks and a `refreshWarning`.

| Acceptance criterion                                                                                                      | Verified by                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Nothing calls `api.openai.com`. Vision goes through OpenRouter with `VISION_MODEL`.                                       | `rg api.openai.com packages apps` finds nothing. A unit test asserts the provider and model id.             |
| For a PNG, OCR runs before vision, and both outputs end up in the indexed text in that order.                             | A pipeline test with mocked OCR and vision asserts the call order and the text.                             |
| When vision throws or times out, the file ends `completed` with its OCR text and a `visionWarning`.                       | A pipeline test that makes vision fail.                                                                     |
| With `VISUAL_ANALYSIS_ENABLED=false`, vision makes no requests and the file still indexes.                                | A unit test asserts zero calls on the provider mock.                                                        |
| A failed refresh of a `completed` file keeps its old chunks searchable and leaves it `completed` with a `refreshWarning`. | A pipeline test that seeds chunks, forces a failure during embedding and checks the chunk count and status. |
| Claiming keeps unrelated metadata keys.                                                                                   | A unit test on the claim update.                                                                            |
| Only images, DOCX and PPTX move to `v3`. A PDF already at `v2` isn't reprocessed.                                         | A unit test on `targetProcessingVersion` plus a reprocess-throttle test.                                    |
| A real image upload is indexed with OCR text plus a description, and the Files UI shows `completed`.                      | agent-browser QA on a preview, with a screenshot and recording uploaded through autobuild.                  |

### D3 — Scanned-PDF OCR (#126 phase 2), built on #561

This is a separate PR that closes #126. When `unpdf` finds no readable text, the pages are rendered to images and passed through #561's OCR engine. It reuses #561's choices: local language data, no CDN, a timeout that terminates the worker, and the packaging set up through `serverExternalPackages`/`outputFileTracingIncludes`. The `recognizeImageText` contract stays as it is. Changes to the OCR module are additive, for example a helper that runs several pages on one worker. The PR body credits #561 and links the contributor so they can review.

- **Renderer:** `pdfjs-dist` or `pdf-to-img`. Prefer one that runs in the Vercel Node runtime without native build steps. The choice is proven by a standalone smoke test with the network disabled, the same way #561 was tested.
- **Limits:** `SCANNED_PDF_OCR_MAX_PAGES` (default 30) and `SCANNED_PDF_OCR_BUDGET_MS` (default 200000), on top of #561's 45 s per-image timeout. A PDF over the page cap fails with a clear message ("This scanned PDF has more than 30 pages. Split it and re-upload.") instead of indexing only part of it.
- **Worker use:** one worker per file, reused across pages. It's terminated on success, error or budget exhaustion. Progress is reported through the existing `updateProgress`.
- **Output:** page texts are joined with `\n\n` and labelled `[Page n]`. When vision is on, each page image is also described by D2's module, within the cap.
- **Copy and docs:** the old "could not extract text, run it through OCR" error becomes a message for real failures only. The supported-types and limits docs are updated.

| Acceptance criterion                                                                                                                                      | Verified by                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| A 3-page image-only PDF fixture indexes as `completed` with the expected words from every page.                                                           | A real-engine test with the network disabled, as in #561's suite.     |
| A 31-page scanned fixture fails with the page-cap message and starts no worker.                                                                           | A unit test that mocks the renderer to report the page count.         |
| If the budget runs out, the worker is terminated and the file fails with a timeout message. No handle is left open (Jest `--detectOpenHandles` is clean). | A unit test with a slow mocked recognizer.                            |
| A text-native PDF never reaches the renderer.                                                                                                             | A pipeline test asserts the renderer mock isn't called.               |
| The standalone production build processes the scanned fixture with the network disabled, and the bundle stays within Vercel's function size limit.        | A smoke-test script with the measured bundle size recorded in the PR. |
| Uploading a scanned PDF in the dashboard ends in `completed`, and chat can answer from its text.                                                          | agent-browser QA with a recording.                                    |

### D4 — Run tokens and refresh visibility (what #462 still needs)

A job claim writes a `processingRunId` into the metadata. Every later write (progress, chunk swap, final status) is conditional on that token. A stale or duplicate delivery whose token no longer matches stops quietly. During a refresh the file stays `completed` and gains `metadata.refreshing=true`, so retrieval and the professor's list never lose a working file.

| Acceptance criterion                                                                        | Verified by                                                            |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| When two deliveries race, exactly one writes chunks and the loser makes no further writes.  | A pipeline test that runs two concurrent invocations on the same file. |
| A refresh of a `completed` file keeps `status='completed'` and stays searchable throughout. | A pipeline test that checks the status during and after the run.       |
| Delivering the same job twice is harmless (this checks the at-least-once assumption).       | A test that runs the same job twice.                                   |

### D5 — A failed publish leaves the file retryable (#463, narrowed)

When the QStash publish fails in `finalize-upload.ts` or `create-file-record.ts`, the row is marked `failed` with "Couldn't queue processing — use Retry." The stored file is kept. The existing Retry action then works straight away instead of after the 60-minute stale window.

| Acceptance criterion                                                                                  | Verified by                                                   |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| A publish rejection leaves the row `failed` with that message, and the storage object is still there. | Unit tests for both call sites with a rejecting publish mock. |
| Retry on that row succeeds immediately.                                                               | A router test for the retry procedure on the failed row.      |

### D6 — RTF uploads (#128)

Add `application/rtf` and `text/rtf`, with the `.rtf` extension, to all three type lists (`validation.ts`, `file-constants.ts`, `file-signature.ts`), including the `{\rtf` magic bytes. Extraction goes through the existing `officeparser`. The empty-text guard and the 60 s timeout stay as they are.

| Acceptance criterion                                               | Verified by                                         |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| An RTF fixture uploads, its text is extracted and it's searchable. | A rag-service extraction test plus a pipeline test. |
| A `.rtf` file without the `{\rtf` signature is rejected.           | A `file-signature` unit test.                       |
| The three type lists agree.                                        | A new parity test across the three lists.           |

## Data integrity and security

_Covers #464, #465 and #480. Each is an independent PR to `main`._

### D7 — Account deletion fails closed (#464)

Reorder `services/user-deletion.ts` to follow `files.delete`:

1.  Collect the storage paths. Rows with `metadata.type === "url"` are excluded.
2.  Remove them in batches through the storage abstraction, which also works in local mode.
3.  If any removal fails, throw before the DB transaction starts.
4.  Only when storage succeeds, run the existing transaction.

A failure returns a retryable error such as "Couldn't remove your files — please try again". The account and its rows are left intact, so a retry is safe. Objects that were already removed may not exist on the retry, and the storage layer must treat a missing object as success. No migration.

| Acceptance criterion                                                                                           | Verified by                                                                                                |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| If storage removal rejects, deletion throws, makes no DB delete, and the user, chatbots and files still exist. | The test at `user-deletion.test.ts:170` is inverted, plus a new assertion that the transaction never runs. |
| Crawled-URL rows are never passed to storage remove.                                                           | A unit test with a mixed fixture of file and url rows.                                                     |
| Local storage mode deletes the files from disk.                                                                | A unit test against the local adapter in a temp directory.                                                 |
| Over 1,000 paths are removed in batches. A retry after a partial removal succeeds.                             | A unit test with a batch-size spy and a test where some objects are already missing.                       |

### D8 — Only one chat turn at a time per session (#465)

`stream-chat.ts` claims the turn with a compare-and-set on `conversations.metadata.activeTurnAt`. The claim succeeds only if the marker is empty or older than 300 s, which is the route's `maxDuration`. If the claim fails, the route returns **409** with `{ code: "TURN_IN_PROGRESS" }`, following the error format #560 introduces. Every exit path clears the marker: `onFinish`, `onError`, abort and thrown errors. The client shows a localized "A response is already in progress — wait for it to finish" and keeps the student's draft. History is read only after the claim succeeds, which removes the read-before-write race.

| Acceptance criterion                                                                                 | Verified by                                                      |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Of two concurrent POSTs for the same session, one streams and the other gets 409 `TURN_IN_PROGRESS`. | A route test with the stream held open.                          |
| The marker is cleared after success, model error, client abort and a thrown exception.               | A unit test for each of the four paths.                          |
| A marker older than 300 s doesn't block a new turn.                                                  | A unit test with fake timers.                                    |
| Different sessions on the same chatbot don't block each other.                                       | A route test.                                                    |
| The 409 shows the localized message in the chat UI, and the draft text is kept.                      | A component test plus agent-browser QA (two tabs, same session). |

### D9 — Remove the anonymous account-status endpoint (#480)

Delete `routers/auth/procedures/status.ts` and its router entry. Remove the fallback in `login/page.tsx`. Delete its rate limiter if nothing else uses it, and fix the misleading comment. Pending and rejected accounts keep getting their message from `session-gate.ts`, which only runs after the password has been verified.

| Acceptance criterion                                                                                                                                                        | Verified by                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `auth.checkUserStatus` no longer exists on the router.                                                                                                                      | A router-shape test, plus `rg checkUserStatus` finds nothing.                                                               |
| A pending account with the right password sees the pending message. With the wrong password it sees the generic invalid-credentials message, identical to an unknown email. | Tests on the session gate and the login page. These also check the assumption that Better Auth verifies the password first. |
| Login works for an approved user.                                                                                                                                           | agent-browser QA, screenshots only.                                                                                         |

## Tests, schema-drift CI and the quiz leak

_Covers #399, #515 and #398. Each is an independent PR to `main`._

### D10 — Correct the Jest ESM guidance and the two suites with inert mocks (#399)

- **Docs:** correct the advice in `AGENTS.md` and `CONTRIBUTING.md`. In ESM mode, `jest.mock` doesn't apply. Use `jest.unstable_mockModule` followed by a dynamic `await import()`, with one short example.
- **Suites:** convert `rate-limit.test.ts` and `files-validation.test.ts` so their mocks actually take effect. Each must fail when its mock is removed.
- **Guard:** if a Jest config runs without `--experimental-vm-modules`, it throws with a clear message (one guard per Jest config). This changes tool config under AGENTS.md §15, and approving this spec counts as that approval.

| Acceptance criterion                                                                              | Verified by                               |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `npm run test` passes with the same suite and test counts as on `main`.                           | CI\.                                      |
| Running Jest without the flag exits non-zero with the guard message instead of 23 suite failures. | A manual run recorded in the PR body.     |
| In both converted suites, removing the mock makes a test fail.                                    | A mutation check recorded in the PR body. |

### D11 — Schema-drift check at deploy time (#515)

Add a `schema-drift` module and a `db:check-drift` script. Inside a read-only transaction, they compare the tables and columns in the Drizzle schema against `information_schema` on the target database. The script exits 1 and lists every missing table or column. In the release-please workflow, it runs as its own step between `db:migrate` and the deploy merge. The fresh-database migration fix comes from #560's `setup-indexes.sql`, so D11 lands after #560.

| Acceptance criterion                                                                                         | Verified by                                                                    |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| On a freshly migrated DB it exits 0 and reports every schema table.                                          | A local PG17 + pgvector run recorded in the PR (as in the research prototype). |
| After a column is dropped it exits 1 and names `table.column`.                                               | The same run with the column dropped.                                          |
| The diff logic is correct for missing tables, missing columns and extra columns (extra columns are ignored). | Unit tests on the pure diff function.                                          |
| The release workflow runs the step, and a failure blocks the deploy.                                         | `actionlint` passes, and the workflow YAML is reviewed in the PR.              |

### D12 — Log quiz-JSON recovery and cover the fallback turn (#398)

`recover-quiz.ts` logs every recovery with `logWarn`, including `modelId`, `chatbotId` and the recovery path taken, with no student text. The no-tools fallback turn in `primary-turn.ts` goes through the same recovery, so a raw quiz JSON blob never reaches a student from either path.

| Acceptance criterion                                                            | Verified by                                    |
| ------------------------------------------------------------------------------- | ---------------------------------------------- |
| A fallback turn whose output is raw quiz JSON is shown as a quiz, not as text.  | A new primary-turn test for the fallback path. |
| Every recovery emits exactly one warning with `modelId` and no message content. | A unit test with a spy on `logWarn`.           |
| Turns that need no recovery log nothing.                                        | A unit test.                                   |

> **Note:** #398 also asks for a per-model audit and possible routing changes. Those need live OpenRouter calls and are listed under Open questions. D12 closes the leak and adds observability either way.

## Product features and contributor PRs

_Covers #540, #559, #315 and #136. The two contributor PRs are reviewed as their work. The two features build on the conventions #560 sets._

### D13 — Land #560 (i18n, #540) as-is after review

Review it with the pr-review rubric. Block only on real defects: build, type or test failures, security problems, data loss, or a broken migration. Its scope, the hard-coded Lingo.dev IDs and its size are accepted, at your call. It keeps migration slot `0021` because it lands first. Any blocking defect goes back to the contributor as review comments. If they don't respond, it's pushed as a minimal maintainer commit that credits them. Someone with GitGuardian access needs to triage its two findings (see Risks). The checks are advisory, but leaving them unread isn't.

| Acceptance criterion                                                                           | Verified by                              |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------- |
| #560 merges to `main` with green required checks and the contributor's authorship.             | `gh pr view 560`.                        |
| The review is posted, and any blocking findings are resolved before the merge.                 | The PR review thread.                    |
| Migration `0021_user_preferred_locale` applies to a fresh DB, and so does `setup-indexes.sql`. | A local PG17 run recorded in the review. |

### D14 — Student ratings on AI responses (#559)

Students rate an assistant message thumbs up or down, and the rating is saved server-side. Professors see the totals.

- **Data:** a new `message_ratings` table with `id`, `messageId` (FK, cascades on delete), `chatbotId`, `sessionId`, `rating` (`up | down`), `createdAt` and `updatedAt`. It's unique on (`messageId`, `sessionId`), so re-rating updates the row. The migration takes the next free number after the migrations already on `main`.
- **Id alignment:** today the persisted assistant row gets a random id (`turn-persistence.ts:137-139`) that differs from the id streamed to the client (`stream-chat.ts:241`). Persist the row with the streamed id so the client can rate the message it actually shows.
- **Write path:** `POST /api/message-rating/shared` follows the `study-response/shared` pattern: anonymous, rate-limited, and checks that the message belongs to the session. On the client, a `submit-message-rating` helper reuses the retry on a 404 caused by the race with `onFinish`.
- **UI:** thumbs buttons on each finished assistant message in the student chat. They're built as a presentational component (`MessageRating`, with props `value`, `onRate`, `disabled`) from the existing button and icon components, with localized labels. Ratings don't survive a reload, which follows from having no session rehydration.
- **Professor side:** an Analytics card shows thumbs up, thumbs down and % positive over a fixed last 30 days, with an empty state. The conversation transcript marks rated messages, and the conversation export includes a rating column.
- **Privacy:** wherever the app lists what student data it collects, add ratings.

| Acceptance criterion                                                                                                               | Verified by                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| The persisted assistant message id equals the streamed id.                                                                         | A stream-chat/turn-persistence test.                                |
| Rating, then re-rating, leaves one row with the latest value. A rating for another session's message gets 404. The limit gets 429. | Route tests.                                                        |
| Rating right after the stream finishes succeeds through the 404 retry.                                                             | A unit test for the client helper.                                  |
| The Analytics card counts only the last 30 days and shows the empty state with zero ratings.                                       | Router query tests on a seeded DB plus a component test.            |
| The export includes the rating column, and the transcript shows the marks.                                                         | Export unit test plus agent-browser QA.                             |
| The student can rate in the browser, and the professor sees the count update.                                                      | agent-browser QA with before and after screenshots and a recording. |
| New strings exist in every locale catalog #560 ships, and its parity test passes.                                                  | The i18n parity test.                                               |

### D15 — Normalize Common Questions grouping (#315, rung 1)

Grouping in `insights.ts` moves from `lower(trim())` to a normalized key. It lowercases, removes punctuation, collapses whitespace and strips a short documented list of leading filler phrases ("what is", "what's", "whats", "explain", "define", "tell me about"). The key is built in SQL so grouping and pagination stay in the database. A pure TS twin of the normalizer is tested against the same fixture table as the SQL. The most recent original wording is shown as the label.

| Acceptance criterion                                                                                       | Verified by                         |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| "What is photosynthesis?", "photosynthesis" and "whats photosynthesis" count as one question with count 3. | A router query test on a seeded DB. |
| The SQL and TS normalizers agree on every fixture.                                                         | A fixture-table test.               |
| Distinct questions stay distinct ("what is mitosis" vs "what is meiosis").                                 | The same fixture table.             |

### D16 — Registration emails (#136): finish #340 or replace it after Nov 20

If the contributor pushes to #340 by **2026-11-20**, review it against your CHANGES_REQUESTED review. If not, a new PR replaces #340, keeps the contributor's commits where they hold up, and credits them, and #340 is closed with a comment linking the new PR. Either way, the acceptance criterion is the owner's review.

| Acceptance criterion                                                                                        | Verified by                                                |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| All 3 blockers and 7 fixes from the 2026-09-16 review are resolved. The nits are resolved or answered.      | A checklist in the PR body that links each review comment. |
| The migration is regenerated to the next free number after `main`'s latest, and applies to a fresh DB.      | A local PG17 run.                                          |
| Email sending goes through the existing Resend wrapper and is covered by mocked tests. No real sends in CI. | Unit tests.                                                |

## Issue housekeeping

### D17 — GitHub comments and status changes

These are public actions on the repo. They're done once the related code has landed, or straight away where no code is involved. Contributors are thanked by name.

| Where      | Action                                                                                                                                                                                        | When             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| #131       | Close as completed, with a comment pointing to #305 and #317 and the matching acceptance criteria.                                                                                            | Now              |
| #137       | Comment that it's on hold pending product validation, and add an on-hold label if one exists. Leave it open.                                                                                  | Now              |
| #463       | Retitle to the remaining scope ("stranded pending row on publish failure"). Close it through D5's PR.                                                                                         | With D5          |
| #561       | Answer the contributor's coexistence question: OCR is the baseline, vision adds descriptions after it, #561 merges first, and a maintainer builds phase 2 on top with them invited to review. | Before D2 merges |
| #126       | Note that phase 1 landed through #561 and that phase 2 is D3. Close it through D3's PR.                                                                                                       | With D1 / D3     |
| #559       | Thank the assignee and say a maintainer is picking it up after #560, as you decided.                                                                                                          | When D14 starts  |
| #550       | Its description is updated to the OpenRouter design and it's retargeted to `release/file-pipeline`.                                                                                           | With D2          |
| All others | Closed by their PRs with `Closes #n`.                                                                                                                                                         | On merge         |

**Acceptance criterion:** at the end, every one of the 17 issues is either closed by a merged PR or a comment, or deliberately open with a comment saying why (#137, and #398 if the audit stays out of scope). This is checked with `gh issue list --state open` in the delivery report.

## Delivery

| Vehicle                    | Deliverables                                                                                        | Target              | Why                                                                                                                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contributor PR #561        | D1                                                                                                  | `main`              | Stands alone and is the base for the file pipeline. It stays the contributor's PR.                                                                                                                         |
| Contributor PR #560        | D13                                                                                                 | `main`              | Your call to land it as-is. Takes migration 0021.                                                                                                                                                          |
| `release/file-pipeline`    | D2 (reworked #550), D3, D4, D5, D6                                                                  | One merge to `main` | Related PRs that share `pipeline.ts` and the type lists. Landing them together means reprocessing to `v3` happens once. Cut from `main` after D1 merges.                                                   |
| `release/response-ratings` | D14 (split by the plan, for example the data and id alignment, the student UI, the professor views) | One merge to `main` | The parts only make sense together. Cut after D13 merges.                                                                                                                                                  |
| Independent PRs            | D7, D8, D9, D10, D11, D12, D15, D16                                                                 | `main`              | Each is self-contained. D8, D9, D11 and D16 land after D13 because they touch #560's files, error format or migration numbering. D10 lands after D1 and D13 because it touches `files-validation.test.ts`. |
| No PR                      | D17                                                                                                 | GitHub              | Comments and status changes.                                                                                                                                                                               |

Workspace policy lets each coder squash-merge its own PR once CI is green. Release branches merge to `main` only after every child PR is merged and the release PR's CI is green.

## Locked decisions, risks and open questions

> **Locked decisions**
>
> 1.  OCR is the free baseline for images and scanned PDFs. Vision adds descriptions after OCR, goes through OpenRouter with an open-weight model (`VISION_MODEL`), and is behind `VISUAL_ANALYSIS_ENABLED` (default on). If vision fails, the file keeps its OCR text and is not marked failed. Nothing calls `api.openai.com`.
> 2.  #561 lands first, unchanged in scope and under the contributor's authorship. Its documented limitations stay as limitations. Scanned-PDF OCR (D3) is a separate maintainer PR on top of it that keeps `recognizeImageText`'s contract, follows its worker and timeout rules, and invites the contributor to review.
> 3.  #550's index scaffolding stays (atomic `replaceFileIndex`, version skip, `refreshWarning`). Its OpenAI provider, its routing of images straight to vision, and its 180 s global timeout are removed.
> 4.  The processing version moves to `v3` only for images, DOCX and PPTX, so the release doesn't re-embed everything else.
> 5.  Scanned PDFs over the page cap (default 30) fail with a clear message rather than indexing only part of the file.
> 6.  Vision descriptions for images embedded in text-native PDFs are a non-goal, so #129's first criterion is only partly met. That extraction would be a follow-up PR on the same release branch if you want it.
> 7.  #560 lands as-is and takes migration 0021. Later migrations (D14, D16) take the next free numbers at the time they're cut.
> 8.  Account deletion fails closed. A concurrent turn gets 409 `TURN_IN_PROGRESS`. `checkUserStatus` is deleted.
> 9.  #315 stops at rung 1. #131 is closed. #137 is on hold.
> 10. Ratings are saved server-side, are anonymous per session, aren't rehydrated after a reload, and the professor card covers a fixed 30 days.
> 11. Delivery: #561 and #560 merge straight to `main`. `release/file-pipeline` holds D2–D6 and `release/response-ratings` holds D14. Everything else is an independent PR to `main`.

### Risks the plan must cover

| Risk                                                                                                      | Mitigation                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bundle size: #561 already adds the Tesseract model and WASM, and D3 adds a PDF renderer.                  | D3's acceptance criteria measure the standalone bundle against Vercel's function limit. If it's over, D3 picks the lighter renderer or trims the browser-only WASM #561 flagged. |
| Tesseract init can hang on a corrupt model (#561's known limitation), and D3 runs it many times per file. | One worker per file, a total budget and termination on every exit path, tested with `--detectOpenHandles`.                                                                       |
| Vision cost when existing images, DOCX and PPTX reprocess to `v3`.                                        | It's lazy and throttled (from #550). Set `VISUAL_ANALYSIS_ENABLED=false` before the release deploys to skip that spend. D2's PR records the per-image price of the chosen model. |
| The two GitGuardian findings on #560.                                                                     | The owner triages them in GitGuardian before the merge. This is a person's step, not something a coder can do.                                                                   |
| Changing the assistant message id (D14) could break existing references to the random id.                 | D14 searches every use of the persisted id. New rows only, with no backfill.                                                                                                     |
| Stale `activeTurnAt` after a crash.                                                                       | The 300 s expiry, tested.                                                                                                                                                        |

### Open questions

1.  **OpenRouter key for verification.** #398's per-model audit and live QA of D2's vision need real OpenRouter calls. If you add an `OPENROUTER_API_KEY` secret to this project, the audit runs and D2 gets live QA. Without it, D2 is verified with mocks plus the preview deploy, and #398 stays open with the audit as remaining work.
