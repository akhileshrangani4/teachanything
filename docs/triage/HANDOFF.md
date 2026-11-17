# Handoff: remaining work after the issue sweep

State checked against GitHub with `gh` on 2026-11-17 (latest `main` at the time: `b53dcb0`). GitHub is authoritative; re-check before acting on anything below. Decisions come from [`spec-open-issue-sweep.md`](spec-open-issue-sweep.md). Dates are UTC.

## Shipped

| Issue | Closed     | Delivered by                                                                                                                                                                                                                              |
| ----- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #540  | 2026-11-13 | #560, merged 2026-11-13                                                                                                                                                                                                                   |
| #315  | 2026-11-13 | #565, merged 2026-11-13                                                                                                                                                                                                                   |
| #515  | 2026-11-13 | #566, merged 2026-11-13                                                                                                                                                                                                                   |
| #398  | 2026-11-14 | #562, merged 2026-11-13, plus a per-model quiz-leak audit posted on #398 on 2026-11-14 (5 registry models, 3 turns each, no leaks)                                                                                                        |
| #464  | 2026-11-13 | #571, merged 2026-11-13                                                                                                                                                                                                                   |
| #480  | 2026-11-13 | #569, merged 2026-11-13                                                                                                                                                                                                                   |
| #465  | 2026-11-13 | #572, merged 2026-11-13                                                                                                                                                                                                                   |
| #559  | 2026-11-13 | Release PR #564 (`release/response-ratings`), merged 2026-11-13. Child PRs into the release branch, all merged 2026-11-13: #568 (UI components), #573 (data and rating API), #574 (formatting), #577 (student wiring and professor views) |
| #131  | 2026-11-13 | Closed as already delivered (by #305 and #317, per the closing comment)                                                                                                                                                                   |

## Open issues and recorded decisions

| Issue | Topic                     | Decision                                                                                                                                                                                                                                   | GitHub state on 2026-11-17                                                                                                                       |
| ----- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| #126  | Image and scanned-PDF OCR | Land contributor PR #561 (images, phase 1) first. Scanned-PDF OCR is a separate phase-2 maintainer PR built on #561's OCR module, crediting the contributor.                                                                               | #561 open, conflicting with `main`; opened 2026-11-13, last commit 2026-11-13                                                                    |
| #129  | Vision model              | Rework PR #550 to an open-weight vision model through OpenRouter, running after OCR, behind a toggle that is on by default (`VISUAL_ANALYSIS_ENABLED`). If vision fails, the file still completes with its OCR text and a `visionWarning`. | #550 open, conflicting with `main`; last commit 2026-10-21                                                                                       |
| #462  | Duplicate file job        | Planned on a `release/file-pipeline` branch, cut from `main` after #561 merges.                                                                                                                                                            | Open. `release/file-pipeline` does not exist yet                                                                                                 |
| #463  | Failed QStash publish     | Planned on `release/file-pipeline` (narrowed scope), after #561.                                                                                                                                                                           | Open                                                                                                                                             |
| #128  | RTF uploads               | Planned on `release/file-pipeline`, after #561.                                                                                                                                                                                            | Open                                                                                                                                             |
| #399  | Jest ESM suites           | Correct the Jest ESM guidance and fix the two suites with inert mocks, as an independent PR to `main` after #561 (it touches `files-validation.test.ts`).                                                                                  | Open                                                                                                                                             |
| #136  | Registration emails       | Contributor PR #340. Wait until 2026-11-20 for an update; if none, open a replacement PR that credits the contributor and close #340 with a link to it.                                                                                    | #340 open, conflicting with `main`; opened 2026-06-11, last commit 2026-08-24, last maintainer review 2026-09-16, last author comment 2026-11-09 |
| #137  | Newsletter                | On hold pending product validation; the issue stays open.                                                                                                                                                                                  | Open; on-hold comment posted 2026-11-13                                                                                                          |

## Open PRs outside the issues above

- **#563** `chore(main): release 1.38.0` (release-please). Open and mergeable. Merging it creates the v1.38.0 release, and the `deploy-production` job in `release-please.yml` then runs. The last release is v1.37.0 (2026-10-31).
- **#575** `Release: trustworthy answers (eval harness, retrieval precision, citations)`. Draft release PR from `release/trustworthy-answers` to `main`, from the separate Platform Research track. The branch contains one child PR, #578 (citation components, merged into the branch 2026-11-13). No PRs exist for the eval harness, retrieval precision, citation protocol or citation wiring. #583's description records that the eval harness was worked on locally but never pushed, and that the other three were not built. Its `validate-pr-title` check fails because the title is not a conventional-commit title; the other checks pass or are skipped. The PR body's subtask table still shows every row as "planned". Decision needed from the owner: finish it or close it. The track's two security fixes merged to `main` separately: #576 (2026-11-13) and #579 (2026-11-13).
- **#583** `docs: export platform research, spec and build history`. Open, opened 2026-11-17. Adds the Platform Research records under `docs/design/`.
- **Dependabot:** #567, #580, #581, #582.

## Bugs found but not fixed

- **Demo-account seed (found during #569):** `packages/db/scripts/seed.ts` writes credential rows with `account_id` set to the email, but Better Auth needs the user id, so seeded demo accounts cannot sign in.
- **Duplicate quiz from Llama 3.3 (found in the #398 audit):** `meta-llama/llama-3.3-70b-instruct` called `showQuiz` twice in 1 of 3 audit turns, rendering two quiz widgets. Both were native tool calls, not a leak.
- **DeepSeek warning (existing):** `deepseek/deepseek-v3.2` triggers the `Dropped a text-end for a text part that is not open` warning on every turn. The existing text-sequence guard handles it.

## Not yet verified

- **#566 schema-drift check through the Supabase transaction pooler.** Verified only on local PostgreSQL 17 over a direct connection. Its first real run is the next production release (no release since v1.37.0).
- **#571 account deletion against a real Supabase bucket.** Storage behaviour was confirmed from the installed `storage-js` source and unit tests only.

## Elsewhere

The Platform Research records (research, the "Trustworthy answers" spec and build history) are not in this folder. They are proposed for `docs/design/` in open PR #583.
