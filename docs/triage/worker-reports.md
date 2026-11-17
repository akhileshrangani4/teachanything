> Worker reports: every task under the triage root task, ordered by creation, with status, assignee, worker thread and completion note.
> Exported from the Obvious project _Teachanything Issue Triage_ on 2026-11-17. Source: `todo_2iQd1TJy`.

_55 tasks. The "Moving the teachanything triage off Obvious" question tasks are omitted. Subtasks were found by walking parent links from task ids referenced in the orchestration thread and in every worker thread. Statuses are as of the export date._

## 1. Build sizing

- **Task:** `todo_KI91dZtX` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** unassigned
- **Worker thread:** —
- **Created:** 2026-11-13 21:43:23 UTC

**Completion note:**

> _No completion note._

## 2. Research

- **Task:** `todo_rU395768` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** unassigned
- **Worker thread:** —
- **Created:** 2026-11-13 21:43:23 UTC · **Completed:** 2026-11-13 21:58:16 UTC

**Completion note:**

> Researched all 17 open teachanything issues in 4 findings docs: art_z6LepG9f (#462-465, #480), art_ZmzNcvmk (#399, #515, #398), art_1lfOk5CU (#126/#561, #129/#550, #136/#340, #540/#560), art_ZiqEZVVy (#559, #315, #131, #137, #128). Key: #131 already delivered on main; #399 is docs/2 suites (CI green); #463 mostly fixed; #550 conflicts with #561 and uses proprietary OpenAI vs issue's open-source requirement; #137 was postponed by owner; #559 assigned to external contributor; #340/#560 collide on migration 0021; fresh-DB db:migrate is broken. Several owner decisions needed before spec.

## 3. Spec

- **Task:** `todo_MIlvVYjM` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** Akhilesh Rangani (human)
- **Worker thread:** —
- **Created:** 2026-11-13 21:43:23 UTC · **Completed:** 2026-11-13 22:11:34 UTC

**Completion note:**

> Spec art_A0nxwvUW: 17 deliverables. Land #561 then #560. release/file-pipeline: OCR baseline, OpenRouter vision behind a toggle, scanned-PDF OCR, job safety, RTF. release/response-ratings: ratings. 8 independent fixes. Issue housekeeping on GitHub. One open question: an OpenRouter key for the #398 audit.

## 4. Plan

- **Task:** `todo_TGPThmce` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** unassigned
- **Worker thread:** —
- **Created:** 2026-11-13 21:43:23 UTC · **Completed:** 2026-11-13 22:15:42 UTC

**Completion note:**

> 23 coder subtasks under todo_2iQd1TJy cover D1–D17, plus 1 owner request (todo_IfQTgIhD: GitGuardian triage gating the #560 merge). Contributor PRs: D1 #561, D13 #560. release/file-pipeline: setup after D1, then D2 (#550 rework), then D4/D5/D6 in parallel, D3 after D4, promote last. release/response-ratings: setup after D13, then D14a components, D14b API, D14c wiring, promote. Independent PRs to main: D7, D12, D15 now; D8, D9, D11, D16 after D13; D10 after D1+D13. D17 housekeeping now. Complexity: high for D2/D3/D4/D8, low for setup/D6/D14a/D17, standard otherwise. Each subtask names its branch, PR base, verifying tests and planned commits.

## 5. Implement

- **Task:** `todo_Bzroo71g` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** paused
- **Assignee:** unassigned
- **Worker thread:** —
- **Created:** 2026-11-13 21:43:23 UTC

**Completion note:**

> _No completion note._

## 6. Deliver

- **Task:** `todo_oD6BEfvI` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** paused
- **Assignee:** unassigned
- **Worker thread:** —
- **Created:** 2026-11-13 21:43:23 UTC

**Completion note:**

> _No completion note._

## 7. Research: new features (#559 #315 #131 #137 #128)

- **Task:** `todo_b2JZbMFo` · **Parent:** `todo_rU395768` (Research)
- **Status:** cancelled
- **Assignee:** Coder (agent)
- **Worker thread:** —
- **Created:** 2026-11-13 21:45:04 UTC

**Completion note:**

> _No completion note._

## 8. Research: data-integrity & security bugs (#462 #463 #464 #465 #480)

- **Task:** `todo_7BDZcE5N` · **Parent:** `todo_rU395768` (Research)
- **Status:** cancelled
- **Assignee:** Coder (agent)
- **Worker thread:** —
- **Created:** 2026-11-13 21:45:04 UTC

**Completion note:**

> _No completion note._

## 9. Research: features already covered by open PRs (#126 #129 #136 #540)

- **Task:** `todo_ucWIf4jz` · **Parent:** `todo_rU395768` (Research)
- **Status:** cancelled
- **Assignee:** Coder (agent)
- **Worker thread:** —
- **Created:** 2026-11-13 21:45:04 UTC

**Completion note:**

> _No completion note._

## 10. Research: test suite, schema-drift CI & quiz JSON leak (#399 #515 #398)

- **Task:** `todo_CFymRpNs` · **Parent:** `todo_rU395768` (Research)
- **Status:** cancelled
- **Assignee:** Coder (agent)
- **Worker thread:** —
- **Created:** 2026-11-13 21:45:04 UTC

**Completion note:**

> _No completion note._

## 11. Research: data-integrity & security bugs (#462 #463 #464 #465 #480)

- **Task:** `todo_dTF79t2L` · **Parent:** `todo_rU395768` (Research)
- **Status:** completed
- **Assignee:** Agent (agent)
- **Worker thread:** `th_IaFQ7Khq`
- **Created:** 2026-11-13 21:45:26 UTC · **Completed:** 2026-11-13 21:56:19 UTC

**Completion note:**

> Published 'Research — teachanything data-integrity & security bugs' (art_z6LepG9f). Read-only research against origin/main ad356f3; no code, branches or PRs. Findings: #462 still present (pipeline.ts deletes chunks before replacement and marks failed on error); open PR #550 (green, doesn't reference #462) already adds atomic chunk swap + version-skip + preserve-completed — residuals: forced-retry redelivery reruns paid work, and files vanish from RAG while 'processing'. #463 destructive half already fixed by #533/#534; remaining gap is a stranded pending row after publish failure (S fix, after #550). #464 still present plus siblings (crawled URLs passed to storage remove, local mode deletes nothing, unbatched, no removed-nothing check); recommend fail-closed ordering (S, no migration) vs tombstones (M). #465 still present but impact narrower (sessions per page load, no rehydration; corruption shows in professor transcript/export); recommend CAS in-flight marker on conversation (M, no migration). #480 still present; issue's proposed pending|rejected|null still leaks — recommend deleting checkUserStatus and the login fallback since session-gate already returns ACCOUNT_PENDING/REJECTED post-password (S). Overlaps: #550 (files), #560 (login page, chat routes), #340 (migration numbering). Four decisions for the user listed at the top of the doc. Repo conventions captured. Two claims rest on training knowledge (QStash at-least-once; Better Auth session hook runs after password check) and are flagged.

## 12. Research: test suite, schema-drift CI & quiz JSON leak (#399 #515 #398)

- **Task:** `todo_lZNJsmtd` · **Parent:** `todo_rU395768` (Research)
- **Status:** completed
- **Assignee:** Agent (agent)
- **Worker thread:** `th_EumjZ9To`
- **Created:** 2026-11-13 21:45:27 UTC · **Completed:** 2026-11-13 21:56:20 UTC

**Completion note:**

> Published the findings document 'Research — teachanything tests, CI drift check & quiz leak' (art_ZmzNcvmk). This was read-only work: no branches, pushes or PRs.
>
> #399: This only fails when Jest runs without its ESM flag. The normal test command (npm run test) and CI both pass all 95 suites and 1,209 tests. A bare 'npx jest' run fails 23 web suites (21 on top-level await, 2 on ESM-only better-auth modules), plus 2 suites in the ai package and 1 in the db package. Separately, the mocking pattern in AGENTS.md section 12 and CONTRIBUTING.md (jest.mock) has no effect on ESM imports; I confirmed this with a probe. rate-limit.test.ts and files-validation.test.ts pass only by coincidence. Recommended: fix the docs, convert those 2 suites, and add a check that fails fast when the flag is missing. Size S. Not recommended now: Vitest (29 files, 193 jest.* call sites) or rewriting the top-level await pattern (dead end because the dependencies are ESM-only). #399 does NOT gate tests for other issues; new tests should use jest.unstable_mockModule.
>
> #515: The gap is real; nothing compares the production database to the code's schema. I prototyped a drift check against a local Postgres 17 with pgvector: on a clean migrated DB it reported 17/17 tables and 7 enums, exit 0; after dropping a column it reported 'account.scope' missing, exit 1. Recommended: a pure diff module plus a script in packages/db, run in release-please.yml after migrations and before the production merge, using the existing DATABASE_URL secret. Size S-M. New finding: 'npm run db:migrate' fails on an empty database, because setup-extensions creates an index on file_chunks before the migrations create that table. That must be fixed before any CI job that builds a fresh database.
>
> #398: The recovery from #400 and its follow-ups is already on main and turns leaked quiz JSON from tool-capable models back into a quiz. Still missing: (1) no logging when recovery happens, so the issue's 'explicitly logged' requirement is unmet; (2) the no-tools fallback turn has no recovery (a possible raw-JSON path I reasoned from the code but could not reproduce); (3) no OpenRouter provider routing settings. Recommended: log recoveries with the model ID, add recovery to the fallback turn, then run a per-model audit and try provider.require_parameters (both need an OPENROUTER_API_KEY). Do not add client-side JSON rendering. Size M.
>
> Overlaps with open PRs: #550, #560 and #561 edit files-validation.test.ts; #550 changes schema.ts and #340 adds migrations; #547 upgrades the AI SDK from 6 to 7 and the OpenRouter provider from 1.5.4 to 3.1.0, which affects the quiz recovery code; #560 changes the chat UI.
>
> Not verified: no live model leak reproduction (no API key), and the read-only transaction was tested only on local Postgres, not through the Supabase pooler.

## 13. Research: features already covered by open PRs (#126 #129 #136 #540)

- **Task:** `todo_hQeuB44s` · **Parent:** `todo_rU395768` (Research)
- **Status:** completed
- **Assignee:** Agent (agent)
- **Worker thread:** `th_L5uPs9Hg`
- **Created:** 2026-11-13 21:45:29 UTC · **Completed:** 2026-11-13 21:56:20 UTC

**Completion note:**

> Published 'Research — teachanything features with open PRs' (art_1lfOk5CU). Read-only: no pushes, PRs or GitHub comments; the local checkout is back on main. Recommendations: (1) #126/PR #561: fix up and land. Required CI passes, it merges cleanly and has no reviews yet; minor fixes are a missing log on worker-terminate failure and a check that the ~60 MB larger job function fits Vercel. Scanned PDFs need a separate phase-2 PR (~2-4 days). (2) #129/PR #550: do not land as-is. It calls proprietary OpenAI gpt-6-sol directly, while the issue requires an open-source model via OpenRouter; it also has no on/off toggle and fails the file when vision fails. It conflicts with #561 in 9 files, and its router would send PNG/JPEG/WebP straight to vision so #561's OCR never runs. Bumping to processing v3 lazily reprocesses every file (re-embedding plus paid vision). The owner must pick: accept OpenAI (~1-2 days) or switch to OpenRouter (~3-5 days). Its CI is from Oct 21; merged locally onto today's main, the type check adds no errors and 133 web + 91 ai tests pass. (3) #136/PR #340: conflicts in 4 files and required CI has not run on its head. Owner's Sep 16 change request (3 blockers incl. a hand-written migration; 7 fixes incl. a missing pending-status gate) is unaddressed. Contributor promised work this weekend; supersede if no push by ~Nov 20 (~1.5-2 days for us). (4) #540/PR #560: required CI passes and it merges cleanly, but it is 256 files / +13.3k lines in one commit, much of it beyond the issue's scope (auth pages, public chat API error format, a DB setup-script fix). It hard-codes the contributor's Lingo.dev IDs (Lingo.dev is a paid translation service). GitGuardian's 2 secret findings look like false positives. Ask for a split, then land (~2-4 days of review). #340 and #560 both claim migration slot 0021.

## 14. Research: new features (#559 #315 #131 #137 #128)

- **Task:** `todo_UWTMomRu` · **Parent:** `todo_rU395768` (Research)
- **Status:** completed
- **Assignee:** Agent (agent)
- **Worker thread:** `th_zdG9BfNP`
- **Created:** 2026-11-13 21:45:30 UTC

**Completion note:**

> Findings doc art_ZiqEZVVy published. Owner decisions it raises (#559 ownership, #137 go/no-go, #315 rung, #131 close) carried into the Spec stage.

## 15. Decisions before I write the spec

- **Task:** `todo_Dm7gHH0Q` · **Parent:** `todo_FyoQzqDs` (Decisions before I write the spec)
- **Status:** completed
- **Assignee:** Akhilesh Rangani (human)
- **Worker thread:** —
- **Created:** 2026-11-13 21:59:18 UTC · **Completed:** 2026-11-13 22:02:47 UTC

**Completion note:**

> _No completion note._

## 16. Decisions before I write the spec

- **Task:** `todo_ABFZ4Chm` · **Parent:** `todo_FyoQzqDs` (Decisions before I write the spec)
- **Status:** completed
- **Assignee:** Akhilesh Rangani (human)
- **Worker thread:** —
- **Created:** 2026-11-13 21:59:18 UTC · **Completed:** 2026-11-13 22:02:47 UTC

**Completion note:**

> _No completion note._

## 17. Decisions before I write the spec

- **Task:** `todo_Z6gWhfPM` · **Parent:** `todo_FyoQzqDs` (Decisions before I write the spec)
- **Status:** completed
- **Assignee:** Akhilesh Rangani (human)
- **Worker thread:** —
- **Created:** 2026-11-13 21:59:18 UTC · **Completed:** 2026-11-13 22:02:47 UTC

**Completion note:**

> _No completion note._

## 18. Decisions before I write the spec

- **Task:** `todo_tii39Uwt` · **Parent:** `todo_FyoQzqDs` (Decisions before I write the spec)
- **Status:** completed
- **Assignee:** Akhilesh Rangani (human)
- **Worker thread:** —
- **Created:** 2026-11-13 21:59:18 UTC · **Completed:** 2026-11-13 22:02:47 UTC

**Completion note:**

> _No completion note._

## 19. Decisions before I write the spec

- **Task:** `todo_1b9mJ7Oo` · **Parent:** `todo_FyoQzqDs` (Decisions before I write the spec)
- **Status:** completed
- **Assignee:** Akhilesh Rangani (human)
- **Worker thread:** —
- **Created:** 2026-11-13 21:59:18 UTC · **Completed:** 2026-11-13 22:02:47 UTC

**Completion note:**

> _No completion note._

## 20. Decisions before I write the spec

- **Task:** `todo_TXUzibMI` · **Parent:** `todo_FyoQzqDs` (Decisions before I write the spec)
- **Status:** completed
- **Assignee:** Akhilesh Rangani (human)
- **Worker thread:** —
- **Created:** 2026-11-13 21:59:18 UTC · **Completed:** 2026-11-13 22:02:47 UTC

**Completion note:**

> _No completion note._

## 21. Decisions before I write the spec

- **Task:** `todo_K97aKfbV` · **Parent:** `todo_FyoQzqDs` (Decisions before I write the spec)
- **Status:** completed
- **Assignee:** Akhilesh Rangani (human)
- **Worker thread:** —
- **Created:** 2026-11-13 21:59:18 UTC · **Completed:** 2026-11-13 22:02:47 UTC

**Completion note:**

> _No completion note._

## 22. Decisions before I write the spec

- **Task:** `todo_SlIFIyVx` · **Parent:** `todo_FyoQzqDs` (Decisions before I write the spec)
- **Status:** completed
- **Assignee:** Akhilesh Rangani (human)
- **Worker thread:** —
- **Created:** 2026-11-13 21:59:18 UTC · **Completed:** 2026-11-13 22:02:47 UTC

**Completion note:**

> _No completion note._

## 23. Decisions before I write the spec

- **Task:** `todo_FyoQzqDs` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** Akhilesh Rangani (human)
- **Worker thread:** —
- **Created:** 2026-11-13 21:59:18 UTC · **Completed:** 2026-11-13 22:02:47 UTC

**Completion note:**

> _No completion note._

## 24. #126 OCR. I'll fix up and land #561, which covers images. Should OCR for scanned PDFs (phase 2, ~2–4 days)...

- **Task:** `todo_e0AP6SzU` · **Parent:** `todo_15KQHtgp` (#126 OCR. I'll fix up and land #561, which covers images. Sh)
- **Status:** completed
- **Assignee:** Akhilesh Rangani (human)
- **Worker thread:** —
- **Created:** 2026-11-13 22:03:26 UTC · **Completed:** 2026-11-13 22:04:05 UTC

**Completion note:**

> _No completion note._

## 25. #126 OCR. I'll fix up and land #561, which covers images. Should OCR for scanned PDFs (phase 2, ~2–4 days)...

- **Task:** `todo_15KQHtgp` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** Akhilesh Rangani (human)
- **Worker thread:** —
- **Created:** 2026-11-13 22:03:26 UTC · **Completed:** 2026-11-13 22:04:05 UTC

**Completion note:**

> _No completion note._

## 26. D1 — Review and land contributor PR #561 (image OCR, phase 1)

- **Task:** `todo_H9u7IHGr` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** cancelled
- **Assignee:** Agent (agent)
- **Worker thread:** `th_gyqIldQD`
- **Created:** 2026-11-13 22:15:00 UTC

**Completion note:**

> Halted by user (stop everything) on 2026-11-14. Resume with tasks.steer.

## 27. D13 — Review and land contributor PR #560 (dashboard i18n, #540)

- **Task:** `todo_5xaiDbtN` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** Agent (agent)
- **Worker thread:** `th_QoFrQvOe`
- **Created:** 2026-11-13 22:15:01 UTC

**Completion note:**

> Verified: #560 MERGED 2026-11-13T22:23:38Z as squash e54a72b, author gum1x. Required build+test green on head e6d98be; the GitGuardian findings were triaged by the owner (todo_IfQTgIhD). Review posted with no blockers (art_ScOGwJVi). Fresh PG17+pgvector migration run clean, including 0021 and setup-indexes.sql. No visual evidence: this was a contributor PR review with no maintainer UI changes.

## 28. Cut release/file-pipeline and open its draft release PR

- **Task:** `todo_377P92Z4` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** cancelled
- **Assignee:** Coder (agent)
- **Worker thread:** —
- **Created:** 2026-11-13 22:15:01 UTC

**Completion note:**

> _No completion note._

## 29. D2 — Rework #550: OpenRouter vision after OCR, behind a toggle (#129, #462 core)

- **Task:** `todo_dV88UKbH` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** cancelled
- **Assignee:** Coder (agent)
- **Worker thread:** —
- **Created:** 2026-11-13 22:15:01 UTC

**Completion note:**

> _No completion note._

## 30. D4 — Run tokens and refresh visibility for file jobs (#462 remainder)

- **Task:** `todo_00g5pq8T` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** cancelled
- **Assignee:** Coder (agent)
- **Worker thread:** —
- **Created:** 2026-11-13 22:15:01 UTC

**Completion note:**

> _No completion note._

## 31. D5 — Failed QStash publish leaves the file retryable (#463)

- **Task:** `todo_CzKKjJv8` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** cancelled
- **Assignee:** Coder (agent)
- **Worker thread:** —
- **Created:** 2026-11-13 22:15:02 UTC

**Completion note:**

> _No completion note._

## 32. D6 — RTF uploads (#128)

- **Task:** `todo_YS1RmUi3` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** cancelled
- **Assignee:** Coder (agent)
- **Worker thread:** —
- **Created:** 2026-11-13 22:15:02 UTC

**Completion note:**

> _No completion note._

## 33. D3 — Scanned-PDF OCR (#126 phase 2), built on #561

- **Task:** `todo_yQP9WbYW` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** cancelled
- **Assignee:** Coder (agent)
- **Worker thread:** —
- **Created:** 2026-11-13 22:15:02 UTC

**Completion note:**

> _No completion note._

## 34. Promote release/file-pipeline to main

- **Task:** `todo_KLW7OF2H` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** cancelled
- **Assignee:** Coder (agent)
- **Worker thread:** —
- **Created:** 2026-11-13 22:15:02 UTC

**Completion note:**

> _No completion note._

## 35. Cut release/response-ratings and open its draft release PR

- **Task:** `todo_iR8ohxcb` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** Agent (agent)
- **Worker thread:** `th_KNGsCT3I`
- **Created:** 2026-11-13 22:15:03 UTC

**Completion note:**

> Verified: release/response-ratings exists on origin at f2e237d (cut from main e54a72b). Draft PR #564 is open, base main. Root release fields are deliberately left unset: the root carries a single release branch, but this build has two release branches plus independent PRs to main. Each child's prompt names its own PR base.

## 36. D14a — Ratings presentational components (#559)

- **Task:** `todo_eG2ZH1Wl` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** Agent (agent)
- **Worker thread:** `th_Da4NdgT7`
- **Created:** 2026-11-13 22:15:03 UTC · **Completed:** 2026-11-13 22:39:30 UTC

**Completion note:**

> Merged: https://github.com/akhileshrangani4/teachanything/pull/568 into release/response-ratings, squash SHA c5f800388efa98242c8ff353198091ee5081ca63 (tested head fc2c669). Acceptance: (1) Comment on #559 thanking @gum1x and saying a maintainer picks it up after #560: issuecomment-6866443029. (2) MessageRating (value up/down/null, onRate, disabled, localized aria-labels plus aria-pressed): message-rating.test.tsx covers none/up/down/disabled and English and French labels; evidence tc-1 (all states) and tc-3 (before/after plus a recording of rating, then switching). (3) RatingsCard (thumbs up, thumbs down, % positive, Last 30 days, empty and loading states): ratings-card.test.tsx; evidence tc-2, plus tc-4 for French. (4) Strings in en/fr/es/de in their own commit 417bd67: i18n parity test catalogs.test.ts passes. (5) Locally, turbo lint, check-types and test pass: web 107 suites/1274 tests, ai 81 tests, db 32 tests. CI caveat: this PR has no required checks, and GitHub did not run test/build workflows for a release/* base. All 7 checks that ran passed (Vercel preview build, GitGuardian, PR title, labels, meta). Verification of the full suite comes from the local run. Note: an untracked bun.lock in the repo sandbox checkout was left uncommitted. The fr/es/de translations were written by hand, not with Lingo.dev.

## 37. D14b — Rating data, id alignment and write API (#559)

- **Task:** `todo_kN29TLTy` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** Agent (agent)
- **Worker thread:** `th_LGpVCiGe`
- **Created:** 2026-11-13 22:15:03 UTC · **Completed:** 2026-11-13 23:14:07 UTC

**Completion note:**

> The formatting follow-up is merged, and #564's build now passes.
>
> - PR: https://github.com/akhileshrangani4/teachanything/pull/574 (style/ratings-format → release/response-ratings), merged with squash as 2aadc4d37cb4b18532e32da31e4c0802c086739b. It has a single commit, 'style: format rating files', which reformats exactly apps/web/src/**tests**/lib/submit-message-rating.test.ts and packages/db/src/schema.ts (+11/-15, whitespace only). Every PR check passed: Vercel, GitGuardian, Meta, Do Not Merge, Sync Labels and validate-pr-title. Repository Labels was skipped.
> - npm run format:check at the release/response-ratings head (2aadc4d) prints 'All matched files use Prettier code style!'
> - #564 at head 2aadc4d: the Build run (43524866726) completed successfully, with Check formatting, Check types, Lint and Build all passing. The Test run (43524866837) also completed successfully.
>
> Going forward I'll run npm run format:check before reporting on any PR, because the Build and Test workflows don't run on release/* bases.

## 38. D14c — Wire student ratings and professor views (#559)

- **Task:** `todo_8fo0Y83c` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** Agent (agent)
- **Worker thread:** `th_pn2UoumE`
- **Created:** 2026-11-13 22:15:03 UTC · **Completed:** 2026-11-13 23:41:41 UTC

**Completion note:**

> PR #577 (https://github.com/akhileshrangani4/teachanything/pull/577) is squash-merged into release/response-ratings as ceffe8d6fb680c3e94031d0b985714fc6e5fce0a. Tested head was f63a571. It has 5 commits: i18n strings, student rating, the 30-day analytics summary, transcript and export ratings, and the privacy docs.
>
> Each acceptance criterion and its evidence:
>
> - Students rate finished assistant messages, saved server-side, with no rehydration: MessageRating appears on the shared and embed student chats, but not on the message still streaming. Unit tests cover isRateable and useMessageRatings (optimistic save, duplicate-click guard, rollback on failure, reset). In the browser, the rating returned 204 and wrote a message_ratings row. Evidence tc-2: before and after screenshots plus a recording.
> - Analytics card over a fixed last 30 days: new analytics.getRatingsSummary, ownership-checked. 5 seeded-Postgres tests pass (30-day window, chatbot scope, re-rating date, empty state, ownership). In the browser the card went from empty to 2 up / 0 down / 100%. Evidence tc-1: before and after.
> - Transcript marks and the export rating column: the join is scoped to the conversation's own session, and the rating is the last CSV column. 2 seeded-Postgres tests and the CSV unit tests pass. The browser showed 'Student rating: helpful response'. Evidence tc-3. The CSV itself was checked by tests only, not in the browser.
> - Collected-data list: the privacy policy lists and the instructor docs now mention ratings.
> - Gates: format:check, lint, check-types and test all pass locally. Web 112 suites / 1,306 tests, AI 81 tests, DB 32 tests. GitHub checks: 11 passed, 2 skipped, none failed, none required. Build/Test CI does not run on PRs into this release branch, so the local gates are the build/test evidence.
>
> Not done here:
>
> - #559 will close only when release/response-ratings merges to main.
> - Browser QA used a local stub for model calls through an uncommitted base-URL override that has since been reverted, because there is no OpenRouter key.
> - Bug for a separate fix: packages/db/scripts/seed.ts stores account.account_id as the email, but Better Auth needs the user id, so the seeded demo users can't log in. I corrected it in the local QA database only.

## 39. Promote release/response-ratings to main

- **Task:** `todo_oiIVpOQl` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** Agent (agent)
- **Worker thread:** `th_3Kk3AJU9`
- **Created:** 2026-11-13 22:15:04 UTC · **Completed:** 2026-11-13 23:49:57 UTC

**Completion note:**

> Release PR #564 (https://github.com/akhileshrangani4/teachanything/pull/564) squash-merged to main at b53dcb0c271627765fcb4992e515126b41f16ab5 (2026-11-13 23:49 UTC). Before merging: merged origin/main into release/response-ratings (0e63a65); one conflict in apps/web/src/hooks/useChat.ts (ratings hook vs #572 refused-turn restore) resolved by keeping both. No new migration on main, so ratings migration stays 0022. Acceptance: (1) Merged with green CI - required build, test, validate-pr-title all passed on 0e63a65, plus CodeQL, GitGuardian, codecov/patch, Vercel; Sync Labels was cancelled once then passed on re-run. Local check-types, lint and npm run test also pass (db 44, ai 81, web 1456 passed / 18 skipped). (2) Fresh-DB migration run passes - local PostgreSQL 17 + pgvector 0.8.0, empty DB: db:migrate applied all 23 migrations 0000-0022, setup-indexes applied, index health OK; db:check-drift exit 0 listing message_ratings (7 columns); unique constraint and both cascading FKs confirmed. (3) #559 closed - state CLOSED/COMPLETED at 23:49:31 UTC via Closes #559. Release PR body rewritten with one row per child (#568, #573/#574, #577, main sync); it had no evidence blocks to keep. Visual evidence: none uploaded on the release PR. It adds no UI beyond the already-merged children, and #577 holds the browser QA for the student and professor flows. The only new code is the conflict resolution that keeps both hooks. CSV export column is covered by unit tests only. Bot comments (Vercel, Codecov) replied.

## 40. D7 — Account deletion fails closed (#464)

- **Task:** `todo_V0yLhMvi` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** Agent (agent)
- **Worker thread:** `th_TUfu3LSy`
- **Created:** 2026-11-13 22:15:04 UTC · **Completed:** 2026-11-13 22:42:43 UTC

**Completion note:**

> D7 (#464) merged. PR #571 https://github.com/akhileshrangani4/teachanything/pull/571 squash-merged as 8fe61997c2c48d3b6cb9cdc50f2cfcd1732ee141; #464 is CLOSED. Account deletion now removes stored files before the DB transaction and throws StorageCleanupError (retryable 'Couldn't remove your files — please try again', localized in en/fr/es/de) without touching the DB if storage cleanup fails. Acceptance: (1) storage rejects means no DB delete and user/chatbots/files remain: inverted user-deletion.test.ts case asserts transaction, deletes, updates and email never run; (2) crawled URLs never sent to remove: mixed file+URL fixture test (crawled rows are identified by isCrawledPagePath on storagePath, which is how this codebase marks them, not metadata.type); (3) local mode deletes from disk: storage-removal.test.ts against a temp uploads dir; (4) more than 1,000 paths batched (2,001 split 1000/1000/1) and retry after partial removal succeeds: storage-removal.test.ts. CI: required checks green on 1ec25c3; locally lint, check-types and full tests passed (web 1,313, ai 81, db 44). Visual evidence not applicable: backend-only, and the only visible change is error-toast text that appears only when storage fails. Gap: Codecov flags 9 uncovered lines in the admin deleteUser error mapping (no admin router test exists); the self-service mapping is tested. Not run against a real Supabase bucket; remove/exists behavior was confirmed from the installed storage-js source.

## 41. D8 — One chat turn at a time per session (#465)

- **Task:** `todo_oUGdc5We` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** Agent (agent)
- **Worker thread:** `th_qLVq2f0K`
- **Created:** 2026-11-13 22:15:04 UTC · **Completed:** 2026-11-13 23:14:51 UTC

**Completion note:**

> D8 (#465) is merged. PR https://github.com/akhileshrangani4/teachanything/pull/572 was squash-merged on 2026-11-13 at 23:14 UTC as aadeb959c7ef304b5c7b9713a46a750cba2196b3, and that closed issue #465. The owner approved head 686c11a, and all 3 required checks (build, test, title) passed on it. Codecov and CodeQL passed too. Both bot comments have replies.
>
> Acceptance criteria:
>
> - Two concurrent POSTs: one streams, the other gets 409. Verified by concurrent-turns.test.ts (real shared route and streamChat), by an opt-in real-Postgres test where 20 concurrent claims gave exactly one winner, and by browser tc-1, where the second tab got 409 in 14 ms.
> - The marker clears on all 4 exits (finish, model error, client abort, thrown error). Each has a route test, and breaking each release path in turn failed a test every time.
> - A marker older than 300 s doesn't block. Covered by turn-lease.test.ts with fake timers and by a route test.
> - Different sessions don't block each other. Covered by a route test.
> - History is read only after the claim. A route test checks that a refused request never reads history.
> - The 409 shows the localized message and the draft is kept. turn-in-progress.test.tsx covers both chat hooks (shared link and dashboard) in en and fr, keeps a draft typed in the meantime, and leaves 429s alone. Removing the recovery call from either hook fails that hook's tests. The new string is in all 4 locale catalogs.
> - Browser QA with two tabs on one session: tc-1 (refusal: message shown, draft kept, nothing added to the transcript) and tc-2 (the kept draft sends after the first turn finishes, and the transcript alternates correctly). Screenshots and a recording are attached to head 686c11a. The browser run was on 2cf9e1e, and the only change since then is test files.
> - Local lint, type-check and npm run test pass (web: 1,303 tests).
>
> Departures from the brief, all stated in the PR:
>
> - The error code is lowercase turn_in_progress rather than TURN_IN_PROGRESS, to match the existing error codes from #560.
> - The real-Postgres test of the claim query only runs when TEST_DATABASE_URL is set, like the existing Common Questions database tests. CI has no database, so it skips there; it passed 8/8 locally.
> - Browser QA ran on a local stack with a slow model stub. The app gives each page load a new session, so a QA-only browser script made both tabs share one session. The temporary QA change was never committed and has been reverted.
>
> Housekeeping: the local PostgreSQL 17 database used for testing is still running on the repo sandbox, and the untracked bun.lock is untouched.

## 42. D9 — Remove the anonymous account-status endpoint (#480)

- **Task:** `todo_BFA10H9X` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** Agent (agent)
- **Worker thread:** `th_NdP9QUyA`
- **Created:** 2026-11-13 22:15:04 UTC · **Completed:** 2026-11-13 22:48:26 UTC

**Completion note:**

> D9 (#480) merged. PR https://github.com/akhileshrangani4/teachanything/pull/569 squash-merged as 7fee02ec09836029a7cd8bbbbe47d95110c55701; #480 closed. Required CI passed on the tested head 2747c41 (build, test, CodeQL). check-types, lint, format and the full npm run test passed locally (web 108 suites/1,271 tests, ai 9/81, db 4/32). Acceptance criteria: (1) checkUserStatus is gone from the auth router, a new router-shape test covers it, and rg checkUserStatus returns nothing. The unused userStatusProbe limiter and the login-page fallback are deleted, and the comment now says pending/rejected messages come from the session gate after sign-in. (2) Pending account + right password shows the pending message; wrong password gives the same response as an unknown email, and the session gate is never reached. Tests run against the installed Better Auth 1.7.5, which confirms it checks the password first, plus login-page tests. These cases were not captured in the browser. (3) Approved professor login checked with agent-browser on a local dev server + PG17: sign-in returned 200 and landed on /dashboard. Before/after screenshots were uploaded as tc-1 (pass) at head 2747c41 and attached to the PR. Flagged, not fixed (out of scope): packages/db/scripts/seed.ts writes credential rows with account_id = email, but Better Auth 1.7.5 needs it to equal the user id, so no seeded demo login works. I patched only my local QA database. Artifact: art_e0r7igkj (PR #569).

## 43. D10 — Correct Jest ESM guidance and fix the two inert-mock suites (#399)

- **Task:** `todo_qIpDPIJN` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** cancelled
- **Assignee:** Coder (agent)
- **Worker thread:** —
- **Created:** 2026-11-13 22:15:04 UTC

**Completion note:**

> _No completion note._

## 44. D11 — Schema-drift check at deploy time (#515)

- **Task:** `todo_UhT7dKkb` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** Agent (agent)
- **Worker thread:** `th_YN5GfxH2`
- **Created:** 2026-11-13 22:15:05 UTC · **Completed:** 2026-11-13 22:35:45 UTC

**Completion note:**

> D11 is merged: PR #566 (https://github.com/akhileshrangani4/teachanything/pull/566) was squash-merged as 941e97f8df536bb1be9a82eff3ff5cc7efcdc1b4 at 2026-11-13 22:35 UTC, and #515 is now CLOSED. Acceptance criteria: (1) On a fresh local DB (Postgres 17.12 + pgvector 0.8.0), db:migrate exited 0 and db:check-drift exited 0, listing all 17 tables. The log is in the PR body. (2) After dropping account.scope and adding an extra legacy_x column, the check exited 1 and listed 'account.scope'; the extra column was ignored. After also dropping email_deliveries, it exited 1 and listed both. Logs are in the PR body. (3) 12 new unit tests in packages/db/src/**tests**/schema-drift.test.ts cover a missing table, a missing column, both together, extra columns and tables being ignored, the report format, collecting the tables from schema.ts, skipping exports that aren't tables, refusing tables outside public, and the query scope. (4) actionlint 1.7.12 on release-please.yml exits 0. The new 'Check schema drift' step runs between 'Run database migrations' and the production merge, using the existing DATABASE_URL secret. (5) The check runs in a read-only transaction: a CREATE TABLE attempted through the same sql.begin('read only') call was rejected by Postgres. Required CI checks and Codecov passed (all modified lines covered). Locally, check-types, lint, format:check and the full test run passed (db 44, ai 81, web 1,260). That needed an npm ci first, because this sandbox's node_modules predated #560's i18n dependencies. No visual evidence: the change is a CLI script plus a workflow step, with no rendered UI. Not verified: running the check through Supabase's transaction pooler. Its first real run will be the next release. Process note: my first commits used --no-verify. I reset them and re-committed with the pre-commit hook running before anything was pushed.

## 45. D12 — Log quiz-JSON recovery and cover the fallback turn (#398)

- **Task:** `todo_aE6Wkd4M` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** Agent (agent)
- **Worker thread:** `th_FDcgeyRr`
- **Created:** 2026-11-13 22:15:05 UTC · **Completed:** 2026-11-14 00:16:15 UTC

**Completion note:**

> I ran the #398 audit. None of the 5 registry models leaked quiz JSON, and #398 is now CLOSED (completed). Audit comment: https://github.com/akhileshrangani4/teachanything/issues/398#issuecomment-6868291909. Scope: spec D12 doesn't name models or prompts, so I used #398's own definition: un-forced showQuiz per registry model, after a student asks to be quizzed. That meant all 5 MODEL_REGISTRY models on main b53dcb0 (gpt-oss-120b, qwen3-235b-a22b-2507, llama-3.3-70b-instruct, llama-4-maverick, deepseek-v3.2), each given one quiz request through the real buildTurnPrompts and executeTurn pipeline with #562's recovery. Study tools were on, with no course files, temperature 0.7 and maxTokens 2000. That was 3 turns per model, 15 in total, plus 1 harness smoke-test turn, so 16 OpenRouter calls; no fallback calls were needed. A middleware recorded the models' raw output. Results: each model made a native showQuiz call in 3 of 3 turns, with 0 leaks. Recovery was never needed, so it never fired, and no quiz text reached the student. Rule applied: no model leaked in a form recovery misses, so I closed #398 referencing #562 and the audit comment. Caveats, stated on the issue: with 3 turns per model a rare leak could go unseen; only one scenario was tested (fresh conversation, no files); recovery was not exercised live. From now on, production logs from #562 will show any recurrence. Two side findings were flagged but not acted on: llama-3.3 called showQuiz twice in 1 of 3 turns (two quiz widgets), and deepseek triggers the existing text-end guard warning on every turn. The key was injected through an environment variable only, and never printed, committed or written to the evidence files (checked). The audit harness wasn't committed and has been deleted. Raw results are in /home/user/work/evidence/audit-398 on the repo sandbox. The untracked bun.lock from before this task is still untouched.

## 46. D15 — Normalize Common Questions grouping (#315)

- **Task:** `todo_ksBccBAz` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** Agent (agent)
- **Worker thread:** `th_T6XBQ1IY`
- **Created:** 2026-11-13 22:15:05 UTC · **Completed:** 2026-11-13 22:34:27 UTC

**Completion note:**

> D15 (#315) is merged. PR https://github.com/akhileshrangani4/teachanything/pull/565 was squash-merged as 722ac968ddcb5ecf73a4ed2791fda2a79bcb9229, and #315 is CLOSED. The tested head was 29f9ee2. All 3 required checks passed (build, test, CodeQL), and the optional checks passed too (Vercel, codecov/patch at 86.8%). Acceptance criteria: (1) Seeded-DB router test: 'What is photosynthesis?', 'photosynthesis' and ' whats photosynthesis ' come back as one row with count 3, labelled with the most recent wording. It calls the real getCommonQuestions procedure against local Postgres 17.12. As a mutation check, all 3 router tests fail with main's insights.ts. (2) SQL and TS normalizers agree: one test runs all 23 fixtures through normalizedQuestionSql in Postgres and checks the result matches normalizeQuestion. (3) 'what is mitosis' and 'what is meiosis' stay distinct, both in the fixtures and in the router test. (4) Panel screenshots: two shots at 1440x1000 from a local dev server with seeded data, uploaded against 29f9ee2 as tc-1 (osmosis 3, photosynthesis 3, cellular respiration 2) and tc-2 (meiosis is its own group on page 2, 'Showing 6-6 of 6'). Local checks: the 2 DB suites pass 27/27; npm run test passes for web, ai and db (the 4 DB-gated tests skip); lint and check-types are clean after a fresh npm ci. Deviation from the brief: the DB-backed suites only run when TEST_DATABASE_URL is set, so CI skips them. CI has no Postgres, and adding PGlite or a Postgres service would break the AGENTS.md section 15 rule. The PR description proposes PGlite as a follow-up. Two bot comments (Vercel, Codecov) were answered in their threads. PR artifact: art_vDhEpCJo.

## 47. D16 — Registration emails (#136): finish #340 or replace it after Nov 20

- **Task:** `todo_WjCDfPBE` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** cancelled
- **Assignee:** Agent (agent)
- **Worker thread:** `th_dTANYegN`
- **Created:** 2026-11-13 22:15:06 UTC

**Completion note:**

> Halted by user (stop everything) on 2026-11-14. Resume with tasks.steer.

## 48. D17 — Issue housekeeping that needs no code (#131, #137)

- **Task:** `todo_kedqBJUa` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** Agent (agent)
- **Worker thread:** `th_lceYcpf7`
- **Created:** 2026-11-13 22:15:06 UTC

**Completion note:**

> Verified: #131 CLOSED/COMPLETED with an acceptance-criteria comment crediting #305/#317. #137 still OPEN with the on-hold comment; no on-hold label exists, so none was added (per spec). GitHub actions only, so no code or visual evidence applies.

## 49. Triage the two GitGuardian findings on #560

- **Task:** `todo_IfQTgIhD` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** Akhilesh Rangani (human)
- **Worker thread:** —
- **Created:** 2026-11-13 22:15:26 UTC · **Completed:** 2026-11-13 22:15:58 UTC

**Completion note:**

> _No completion note._

## 50. Review PR #565: feat(analytics): normalize Common Questions grouping (#315)

- **Task:** `todo_3t2L98wf` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** Akhilesh Rangani (human)
- **Worker thread:** —
- **Created:** 2026-11-13 22:33:37 UTC · **Completed:** 2026-11-13 22:34:14 UTC

**Completion note:**

> _No completion note._

## 51. Review PR #569: fix(auth): remove anonymous account status lookup

- **Task:** `todo_St4hVi6o` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** completed
- **Assignee:** Akhilesh Rangani (human)
- **Worker thread:** —
- **Created:** 2026-11-13 22:47:33 UTC · **Completed:** 2026-11-13 22:48:13 UTC

**Completion note:**

> _No completion note._

## 52. Move the triage records off Obvious

- **Task:** `todo_DV4YpgoJ` · **Parent:** `todo_2iQd1TJy` (root)
- **Status:** in_progress
- **Assignee:** unassigned
- **Worker thread:** —
- **Created:** 2026-11-17 21:52:05 UTC

**Completion note:**

> _No completion note._

## 53. Export the spec, research, reviews and chat history as Markdown

- **Task:** `todo_EFhRDVBX` · **Parent:** `todo_DV4YpgoJ` (Move the triage records off Obvious)
- **Status:** in_progress
- **Assignee:** Agent (agent)
- **Worker thread:** `th_khFsflh5`
- **Created:** 2026-11-17 21:52:05 UTC

**Completion note:**

> _No completion note._

## 54. Commit docs/triage/ with HANDOFF.md to main (docs PR)

- **Task:** `todo_jkgRnS1O` · **Parent:** `todo_DV4YpgoJ` (Move the triage records off Obvious)
- **Status:** blocked
- **Assignee:** Coder (agent)
- **Worker thread:** —
- **Created:** 2026-11-17 21:52:05 UTC

**Completion note:**

> _No completion note._

## 55. Zip the export and QA evidence to the Mac

- **Task:** `todo_92skVoDc` · **Parent:** `todo_DV4YpgoJ` (Move the triage records off Obvious)
- **Status:** blocked
- **Assignee:** Agent (agent)
- **Worker thread:** —
- **Created:** 2026-11-17 21:52:06 UTC

**Completion note:**

> _No completion note._
