> Research document: teachanything features with open PRs.
> Exported from the Obvious project _Teachanything Issue Triage_ on 2026-11-17. Source: `art_1lfOk5CU`.

# Research: teachanything features with open PRs

**Scope:** issues #126, #129, #136 and #540, which each already have an open PR (#561, #550, #340, #560). This was read-only research: no pushes, no PRs and no GitHub comments.
**Snapshot:** `origin/main` = `ad356f3` (release 1.37.0, 2026-10-31), read on 2026-11-13.
**Method:** I read each issue body and its comments, then each PR's description, comments, reviews, inline comments, diff and checks with `gh`. I test-merged every PR head against `origin/main` with `git merge-tree`. For #550, whose CI is three weeks old, I also merged it locally onto main and re-ran the type check and the file-pipeline tests (details below).
**Required checks on `main`:** I read these from the repository ruleset. Only `build` and `validate-pr-title` are required. Vercel, GitGuardian and codecov are optional and don't block a merge. The ruleset requires 0 approvals and only allows squash merges.

> **Load-bearing assumption:** the four "open PR exists" labels suggest the work is nearly done. For #561 that is broadly true. For the other three it is not. #550 implements a different product decision from its issue: a proprietary OpenAI model instead of an open-source one. #340 is stale and has 10 review items outstanding. #560 is about 4× the scope its issue asks for. Each recommendation below depends on what the diff actually contains, not on the PR being open.

## Summary

| Issue             | PR                     | Required CI                                                        | Conflicts vs main                                       | Outstanding review                                                                     | Recommendation                                                                                                            | Remaining effort (estimate)                                                                         |
| ----------------- | ---------------------- | ------------------------------------------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| #126 OCR          | #561 (phase 1, images) | ✅ build, title pass on head `5315f2e`                             | None (based on main tip)                                | No reviews yet                                                                         | **Fix up and land** phase 1, then write phase 2 (scanned PDFs) as a **separate PR**                                       | Phase 1: ~0.5 day review + small fixes. Phase 2: ~2–4 days                                          |
| #129 Vision       | #550 (carries #524)    | ✅ on head `694e570` (Oct 21). Re-verified locally on today's main | None textually; **9-file conflict with #561**           | No reviews or inline comments                                                          | **Do not land as-is against #129.** It needs an owner decision on the model provider, then a rework to sit on top of #561 | ~1–2 days if OpenAI is accepted; ~3–5 days if the issue's open-source/OpenRouter requirement stands |
| #136 Admin emails | #340                   | ❌ No required checks have run on the head (it conflicts)          | **4 conflicting files**, including a deleted `admin.ts` | **CHANGES_REQUESTED**: 3 blockers + 7 fixes + 5 nits, all unaddressed since 2026-09-16 | **Hold briefly for the contributor, then supersede.** They promised work "over the weekend" on Nov 9                      | Contributor: rebase + 10 items. Us, if superseding: ~1.5–2 days                                     |
| #540 i18n         | #560                   | ✅ build, title pass on head `e6d98be`                             | None (based on main tip)                                | No human review (the Copilot review failed on quota)                                   | **Fix up and land, after splitting it.** The PR is 256 files / +13.3k lines, a lot of it outside the issue's scope        | ~2–4 days of review plus contributor revisions                                                      |

**Merge order that avoids rework:** #561 → (decision) → reworked #550 → #126 phase 2. Separately, **#340 and #560 both claim migration slot `0021`** (main already has 0019 and 0020). Whichever lands second must regenerate its migration.

---

## #126 OCR for image uploads and scanned PDFs: PR #561

**Issue asks (updated Nov 2026):**

1. Accept JPG/PNG/WEBP/TIFF uploads, with magic-byte signatures (WEBP needs offset-8 matching).
2. A private `extractImage` in `rag-service.ts`.
3. An OCR fallback for scanned PDFs, joining pages with `\f` so chunks keep `pageNumber`.
4. A separate OCR timeout and/or page cap, plus per-page progress, without raising the global 60 s `EXTRACTION_TIMEOUT_MS`.
5. A fix for the "run it through OCR" error copy.
6. Docs.
7. Verification on a production standalone build.

The issue explicitly allows splitting the work into images first and scanned PDFs second. It is assigned to `barneysmith-sys`, the PR author. Earlier attempts #164, #293, #303 and #306 were closed unfinished.

**PR implements (3 commits, +1593/−31, 41 files):**

- Tesseract.js 7 OCR in a new `packages/ai/src/image-ocr.ts`. It has its own 45 s timeout, kept deliberately below the 60 s pipeline timeout, and that timeout _terminates_ the worker rather than just abandoning the promise.
- English model data loaded from disk via `@tesseract.js-data/eng`. There is no CDN fetch, and `cacheMethod: "none"` handles the read-only serverless filesystem.
- A 30 MP cap, header-based dimension parsing, rejection of multi-page TIFFs, and correction for all 8 JPEG EXIF orientations.
- Image signatures in `file-signature.ts`, with a `null` wildcard so WEBP can match at offset 8.
- Image-specific branches in `processing-error.ts`.
- `serverExternalPackages` and `outputFileTracingIncludes` entries for `/api/jobs/process-file`.
- An updated docs page.

**Gaps vs the issue (expected for phase 1):**

- No scanned-PDF fallback (requirements 3–4). This is stated as out of scope.
- The generic PDF "no readable text → run it through OCR" message is unchanged. That is still correct until phase 2 ships.
- No per-page progress. A single image is one OCR call, so this doesn't apply yet.
- The PR says "Part of #126" and has no closing keyword, which is correct: the issue must stay open.

**CI:** both required checks pass on the head (`build` 2m13s, `validate-pr-title`), and so do `test` and `codecov/patch`. The `Vercel` check shows "Authorization required to deploy", the usual fork gate. A later Vercel bot comment reports a Ready preview deployment. Neither is required.

**Conflicts:** none. The PR's merge base _is_ main's tip `ad356f3`.

**Review:** no reviews and no inline comments. The contributor's latest issue comment asks the maintainer how #561 should coexist with #550. That question is unanswered.

**Code quality: generally high.** The worker lifecycle is carefully reasoned and each workaround has a comment explaining why. Concerns:

- **Bundle size:** by the PR's own note, the `process-file` function grows by about 60 MB, about 24 MB of which is browser-only `.wasm.js` that ended up in the trace for unknown reasons. Check this against the Vercel function size limit before merging. I didn't measure the deployed bundle.
- **Known engine hang:** a _corrupted_ (not missing) model file can hang worker start-up until the 45 s deadline and leave one idle thread. An invalid model can also throw an uncaught `TypeError`. Behaviour on Vercel is unverified, according to the PR. The missing-file case is guarded.
- **Silent catches:** `errorHandler: () => {}`, `work.catch(() => {})` and `terminate().catch(() => {})`. Each one has a written reason, and the original rejection still reaches the caller. The terminate failure is swallowed with no log, though. Adding a `logWarn` would be the small fix.
- **Duplicated types:** two identical `tesseract-data.d.ts` shims (`packages/ai` and `apps/web`), deliberately mirrored from the existing `pdf-parse-lib.d.ts` pattern. Codecov counts one of them as 19 uncovered lines.
- **Unverified approval:** the PR body says both dependencies were "discussed and approved by the maintainer". The issue thread I read shows the contributor _asking_ that question, and I found no maintainer reply. The approval may have happened somewhere else. I couldn't verify it.
- **Review history:** the first commit is authored "Claude" (AI-assisted). That is just a note for reviewers, not a defect.

**Does the scanned-PDF remainder need separate work?** Yes. It's a different problem:

- PDF→image rendering. The issue prefers pure JS/WASM such as `pdfjs-dist` or `pdf-to-img`, which would be a new dependency.
- A page cap or longer OCR budget inside the job's `maxDuration = 300`.
- Per-page `updateProgress`.
- A `\f` page join.
- A rewrite of the generic error message.

It should reuse #561's `recognizeImageText`, with one worker per file rather than one per page. **It overlaps directly with #550,** which already sends image-only PDFs to OpenAI vision (see below). That overlap is why the order and design decision matter.

**External dependencies:** `tesseract.js` ^7 and `@tesseract.js-data/eng` ^1. Both are free, run in-process and need no API key.

**Recommendation: fix up and land phase 1.** Ask for a `logWarn` on terminate failure and a deployed-bundle size check, and confirm the dependency approval on the record. Then do phase 2 as a separate PR.

- Phase 1 remaining: about half a day of maintainer review plus minor fixes.
- Phase 2: about 2–4 days. Most of the risk is in the time budget and the standalone build.

---

## #129 Open-source vision model: PR #550 (supersedes #524)

**Issue asks:**

- Vision support **via OpenRouter**, using an **open-source vision model ("not GPT-4o or Claude")**.
- Extract images embedded in PDFs and PPTX, and handle standalone images.
- Add descriptions to the text before chunking.
- Make the model configurable, with an on/off **toggle** (env var or chatbot setting) that **defaults to enabled**.
- **Graceful degradation:** vision failures must not block text extraction.
- Show progress during vision analysis.

The issue also says to do #126 (and #127) first.

**PR implements (11 commits, +3149/−280, 45 files):** this is oliviameng's #524, rebased by the maintainer's autobuild with review fixes. #524 was closed by its author on 2026-10-31.

- `visual-analysis.ts` calls the **OpenAI Responses API directly** (`https://api.openai.com/v1/responses`). The default model is `OPENAI_VISION_MODEL=gpt-6-sol`, it reuses `OPENAI_API_KEY`, and responses are JSON-schema structured.
- Standalone PNG/JPEG/WebP/GIF images are analysed. **There is no TIFF support.**
- Image-only PDFs are sent whole as `input_file` (≤50 pages, <50 MB).
- DOCX/PPTX embedded raster images are extracted from the zip, capped at 40 images / 25 MB, with referenced media ordered first.
- A new `analyzing` progress stage.
- `CURRENT_PROCESSING_VERSION` goes from 2 to 3, with `refreshFailedAt`/`refreshWarning` so a failed paid refresh keeps the old index and isn't charged again on chat access.
- `force` is threaded through `publishFileProcessingJob`.
- Atomic chunk replacement (`file-index-storage.ts`).
- The extraction timeout goes from 60 s to 180 s.
- Privacy policy and docs are updated.

**Gaps vs the issue (material):**

- ❌ **It uses a proprietary model (OpenAI) through the OpenAI API, not an open-source model through OpenRouter.** This is the issue's headline requirement. Neither #550 nor #524 mentions #129.
- ❌ **No on/off toggle.** Only the model name is configurable, through an env var. There is no per-chatbot setting.
- ❌ **No graceful degradation.** A vision failure on a DOCX/PPTX with images, on an image-only PDF or on a standalone image fails the whole file. #524's description says it "fails instead of silently indexing partial content". That is the opposite of the issue's acceptance criterion, although it is a defensible design choice.
- ⚠️ Images embedded in **text-native** PDFs are never described, because of the cost gate added as a maintainer decision. That partly misses AC1.
- ⚠️ Standalone images get vision **only**. There is no OCR text "in addition", which the issue's AC3 asks for.

**Overlap with #126 / #561: direct, in two places.**

1. **The same files.** A test merge of #550 against #561 conflicts in 9 files: `validation.ts`, `file-constants.ts`, `UploadFileDialog.tsx`, `use-upload-queue.ts`, `processing-error.ts`, `file-signature.ts`, `file-signature.test.ts`, `files-validation.test.ts` and `upload-materials.mdx`. Both PRs add the image MIME types, signatures and copy, in different shapes.
2. **Image routing.** #550's `extractMaterialContent` sends any `IMAGE_MIMES` file straight to `analyzeImages` _before_ `RAGService.extractContent` is reached. If both PRs merge naively, **#561's Tesseract path would never run for PNG/JPEG/WebP**. Only TIFF would reach OCR. Scanned PDFs (#126 phase 2) are the same story: #550 already routes them to paid vision.

The right architecture is to treat OCR as the free baseline text and vision as optional enrichment. That needs a deliberate integration, not a conflict resolution.

**CI:** the required checks and CodeQL pass on head `694e570`, but those runs date from 2026-10-21, and main has moved 10 commits since. `git merge-tree` against today's main is clean. **Local re-verification on a merge of #550 into today's main:**

- `apps/web` `tsc --noEmit` reports 1 error, `auth-client.ts` TS2742. That error is also present on unmodified main in this sandbox, so #550 introduces no new type errors.
- Web file-pipeline suites (material-content, visual-analysis, office-images, process-file-route, reprocess, retry, files-validation, file-status): 8/8 suites, 133/133 tests pass.
- `packages/ai`: 10/10 suites, 91/91 tests pass.
- I didn't re-run lint or the full suite.

**Review:** no reviews or inline comments on #550 or #524. The fixes came from a maintainer review that was run through autobuild.

**Code quality concerns:**

- **Cost and blast radius of the version bump:** v2→v3 makes **every completed file** eligible for lazy reprocessing on chat access, throttled per access. That re-embeds everything with OpenAI embeddings, and DOCX/PPTX files with images will also incur paid vision calls. This is inferred from `reprocess.ts` and `file-status.ts`. I haven't quantified the cost.
- `pipeline.ts` was rewritten (+134/−129), and codecov reports **0% patch coverage** on it (134 lines). The `abandonProcessing` path for missing storage became a `throw`.
- The global extraction timeout went from 60 s to 180 s. #126's issue text explicitly says "do not just raise the global timeout". The two issues give conflicting guidance here.
- A hand-rolled `fetch` client with retry, instead of the existing `openrouter-client.ts`/AI SDK. Its error-type checks match on `error.message.includes("OpenAI")`.
- The scanned-PDF ceiling is "≤50 pages per request". Pagination is explicitly deferred.

**External dependencies / paid services:** OpenAI API (paid, per token). No new npm dependency and no DB migration (metadata is jsonb). Student course material is sent to OpenAI (`store: false`), and the PR updates the privacy policy to say so.

**Recommendation: needs an owner decision first. Don't land as-is as the fix for #129.**

- **Option A, accept OpenAI** (amend #129 to match): fix up #550 by rebasing it onto #561 after that merges and routing standalone images to OCR + vision instead of vision only. Add the toggle, decide on graceful degradation and confirm the reprocess cost is acceptable. **~1–2 days.**
- **Option B, honour #129 as written** (open-source via OpenRouter): keep #550's scaffolding (versioning, refresh-failed guard, atomic index swap, office-image extraction, progress stage) and **supersede the provider layer**. That means rewriting `visual-analysis.ts` for OpenRouter's chat format with `image_url` parts. Scanned PDFs would also need rendering to images (shared with #126 phase 2), because whole-PDF `input_file` is an OpenAI Responses feature. **~3–5 days.**
- **What tips it:** if per-file cost or data-residency matters (education materials going to OpenAI), choose B. If time-to-ship matters more and the owner is already comfortable with OpenAI, as the earlier maintainer review suggests, choose A and edit the issue.

---

## #136 Automated email templates for incomplete registrations: PR #340

**Issue asks:**

- Three React Email templates.
- New `emailTypeEnum` values with a generated migration.
- `send*Email` wrappers that use `queueEmail` (QStash → Resend, with tracking).
- An admin-only `sendRegistrationEmail` tRPC procedure.
- A "Send Email" dialog with template select, preview and custom message.
- Optional rate limiting. No new dependencies.

**PR implements (5 feature commits + 3 merge commits, +1473/−20, 16 files):** all of the above. It also includes an unrelated `seed.ts` change, a global `console.warn` mock and a `replyTo` change to `sendRejectionEmail`. Most commits are authored `R-Mamilla`; the PR is opened by `M-Rakshitha`.

**CI:** ❌ the required checks (`build`, `validate-pr-title`) have **not run on head `c2d51f7`**. Only Vercel (fork authorization failure) and GitGuardian (pass) are present. This is consistent with GitHub not running `pull_request` workflows on a PR that conflicts, but I inferred that and didn't confirm it from the Actions logs.

**Conflicts:** `mergeable: CONFLICTING`. The merge base is 59 commits behind main. Conflicting files: `PendingUsersTab.tsx`, `server/email/notifications.ts`, `drizzle/meta/_journal.json`, and a modify/delete on `server/routers/admin.ts`, which main deleted and split into `admin/index.ts` + `admin/procedures/*` in #458. The owner's review also flags files that merge cleanly but break the build because they import `@/lib/email`, which no longer exists.

**Outstanding review:** owner `akhileshrangani4` posted **CHANGES_REQUESTED on 2026-09-16** with a full summary and inline comments. None of it has been addressed. The branch hasn't been pushed since 2026-08-23.

- **3 blockers:**
  - The migration was hand-written. It edits the frozen `0014_snapshot.json`, has no `0019_snapshot.json` and a bad journal timestamp.
  - `seed.ts` throws a TDZ `ReferenceError`.
  - The templates say `™` instead of `®`.
- **7 "worth fixing":**
  - No `status === "pending"` gate. The owner calls it a phishing primitive: an admin can free-text email _any_ user.
  - Hand-rolled per-recipient rate limiting counts failed deliveries, so recipients can be locked out. It should use `adminActionRateLimit`.
  - No audit trail of who sent what. The fix is to thread `{sentByAdminId, templateId}` into `emailDeliveries.metadata`.
  - The preview copy is duplicated and has already drifted.
  - The dialog must move to `pending-users-tab/send-email-dialog.tsx`.
  - Two tests are meaningless: one copies the schema instead of importing it, the other uses `typeof` assertions.
  - A global `console.warn` mock.
- **5 nits:** a non-null assertion that should be a discriminated union, a double parse, a contradictory footer, newlines collapsing (needs `pre-wrap`), and the undisclosed `replyTo` change.

**Drift since the review:**

- The review said "slot 0019 is free". It isn't any more. Main has `0019_wise_killraven` and `0020_user_files_user_id_idx`, so the regenerated migration will be **0021**. **#560 also adds `0021_user_preferred_locale`**, so these two collide.
- `requireExistingUser` now lives in `server/routers/admin/helpers.ts`, and `adminActionRateLimit` exists in `server/rate-limit.ts`.
- `queueEmail` (`server/email/delivery.ts`) doesn't currently accept a `metadata` param, so the audit-trail fix needs a small change there.

**Thread history:** the contributor pinged on 2026-07-06 about a new conflict. The owner reviewed on 09-16. On 11-09 the owner closed the PR for inactivity, the contributor asked to keep it open ("about to work on this over the weekend"), and the owner reopened it.

**External dependencies:** none new. It uses Resend + QStash, which are already configured, plus one enum migration.

**Recommendation: give the contributor the window they asked for, then supersede if nothing lands.** The owner reopened the PR at the contributor's request two days ago, so superseding immediately would go against that. Suggested trigger: no push by about 2026-11-20. Superseding means carrying the commits forward with authorship credit, the same pattern used for #524→#550.

- Contributor path: rebase (mostly path moves) + 3 blockers + 7 fixes.
- Our path if superseding: **~1.5–2 days**, because the review already spells out every fix.
- Building fresh would save little. The templates and handler structure are right, by the owner's own assessment.

---

## #540 Dashboard UI language (French, Spanish, German): PR #560

**Issue asks:**

- A dashboard language setting for `en` (default and fallback), `fr`, `es` and `de`.
- **In scope:** everything under `app/(dashboard)`, meaning home, chatbots, files, web sources, settings, plus their dialogs, toasts and form errors.
- **Out of scope:** landing page and legal pages, the public chat and embed (`app/chat`, `app/embed`), admin pages, Resend emails, and chatbot answer language.
- The issue has no assignee and no comments.

**PR implements (1 squashed commit by `gum1x`, +13,311/−2,245, 256 files):**

- i18next + ICU, with catalogs in `apps/web/messages/{en,fr,es,de}.json`.
- A settings language selector with "Use browser language".
- A `user.preferred_locale` column (migration `0021`), plus cookie and `Accept-Language` fallback.
- Catalog-parity tests.
- Locale-aware dates, numbers and file sizes.
- Lingo.dev config and scripts.

**Beyond the issue's scope (from the file list and diff):**

- **Auth pages** (`app/(auth)`, 11 files), which the issue doesn't mention.
- **The public chat API error contract:** `/api/chat` _and_ `/api/chat/shared` now return `{ "code": "..." }` JSON instead of plain text. The shared route serves student and embed traffic, which the issue lists as out of scope.
- `app/embed/layout.tsx` now loads root messages.
- `DashboardShell` merges two layouts.
- `appError` carries catalog keys across about 30 router files.
- Typed crawler errors (`packages/ai/src/crawler.ts`) and `packages/ai/src/models.ts`.
- `country-options.ts` (214 lines, 0% coverage).
- **An unrelated DB-tooling change:** the FTS index and the trigram-index drop move from `setup-extensions.sql` into a new `setup-indexes.sql` that runs _after_ migrate/push. This looks like a real bug fix for empty databases, because main's `setup-extensions.sql` creates an index on `file_chunks` before any table exists. I inferred that from reading the scripts and didn't run it. Either way it belongs in its own PR.
- The PR doesn't link #540 (no closing reference).

**CI:**

- ✅ Required: `build` and `validate-pr-title` pass, and `test` passes.
- ❌ Optional: `codecov/patch` at 49.8% (692 lines uncovered).
- ❌ Optional: **GitGuardian reports 2 "Company Email Password" findings** in `messages/es.json` and `messages/fr.json`. The flagged region (es.json ~L985–992) is the `auth.fields` block: an email placeholder `nombre@universidad.edu` next to the translated label "Contraseña". That is very likely a false positive, but someone with GitGuardian access should mark it as one, because merging otherwise creates incidents.
- ❌ Optional: Vercel shows the fork authorization gate.

**Conflicts:** none. The PR is based on main's tip. It does share migration slot 0021 with #340, though.

**Review:** none from a human. Copilot's review failed on quota. The PR's test plan claims a fluent speaker reviewed the FR/ES/DE wording, which I can't verify.

**Code quality concerns:**

- **Reviewability:** a single 256-file, 13k-line commit is hard to review safely.
- **Third-party config:** `.lingo/config.json` hard-codes `orgId: org_yI7dS7d0kPKXg33CuUzI` and `engineId: eng_VQSNpEWxyRRzSgrSutzK`. These are presumably the contributor's Lingo.dev account. The `i18n:translate` script calls `npx -y @lingo.dev/cli@1.17.1` at run time.
- **Pinned versions:** the new dependencies use exact pins (`i18next` 26.5.3, `react-i18next` 17.1.0, `i18next-icu` 2.6.1, `intl-messageformat` 12.1.4), while the rest of `apps/web` uses `^` ranges. That's a minor inconsistency.
- **API contract change:** any client that reads plain-text errors from `/api/chat/shared` changes behaviour. The app's own chat UI is updated in the same PR, so in-repo consumers are covered. I didn't audit external embed consumers.

**External dependencies / paid services:**

- Runtime: four new npm packages, all free.
- **Lingo.dev** is a paid, per-token translation service, used only for the translation scripts and not at runtime. Adopting it means the maintainer opens their own Lingo.dev account and API key and replaces the hard-coded IDs, or drops the Lingo config and maintains catalogs by hand or through another tool.

**Recommendation: fix up and land, but ask for a split first.**

1. The DB `setup-indexes` fix as its own small PR. It's independently valuable.
2. i18n infrastructure + language selector + `(dashboard)`/chatbot-management strings. This is the issue.
3. The chat API error-code contract and the auth/embed translations as follow-ups, or explicitly accepted scope expansions.

Other things to settle: decide on Lingo.dev and remove the contributor's org/engine IDs, triage the GitGuardian findings, and coordinate migration numbering with #340.

Estimate: about 2–4 days of maintainer review time plus contributor revisions. Building fresh would throw away a large, CI-green, mostly-correct body of work, so it isn't recommended.

---

## Cross-cutting notes

- **The #126/#129 file-pipeline plan has to be decided before either lands.** Both PRs claim the image MIME types, signatures and upload copy, and #550's router would make #561's OCR unreachable for PNG/JPEG/WebP. Suggested contract:
  - OCR (#561) is the free baseline text for images, and later for scanned PDFs (#126 phase 2).
  - Vision (#550/#129) is optional enrichment layered on top behind a toggle.
  - When vision fails, keep the OCR/native text instead of failing the file.
- **Migration slot 0021** is claimed by both #340 (once regenerated) and #560.
- **Paid services introduced:** OpenAI vision (#550: per-file cost, plus the v3 reprocess wave) and Lingo.dev (#560, tooling only). #561 and #340 add no paid services.
- **Required-check reality:** only `build` and `validate-pr-title` gate merges. Codecov, GitGuardian and Vercel failures are advisory under the current ruleset.
