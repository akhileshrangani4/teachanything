# Chat: D4a: Citation UI presentational components

- **Source thread:** `th_amj4awr3`
- **Task:** `todo_Il0vBNhF` ("D4a: Citation UI presentational components")
- **Exported:** 2026-11-17 (messages up to 2026-11-13 23:40:05.330 UTC)
- **Messages:** 3 user and assistant text messages, out of 125 thread entries; tool calls, tool results and reasoning are omitted.

Each message is reproduced verbatim inside a text fence, oldest first. `user` is the role the platform recorded: it covers Akhilesh Rangani's own messages and platform-delivered ones (task briefs, run-engine steps, GitHub signals, sub-thread results, reminders). `assistant` is the Obvious agent.

## 1. user — 2026-11-13 23:23:18.482 UTC

```text
## Assigned computer
Use `computerId: "cmp_m3rUfWXx"` for source, edits, builds, tests, and git. Keep file-consuming commands on the computer holding those files. Platform-only operations can use obvious-sdk.

[AUTOBUILD] Pre-assigned branch: feat/citation-ui-components
You MUST use this branch for your work.
[AUTOBUILD] Assigned subtask: todo_Il0vBNhF
[AUTOBUILD] Acceptance criteria (mustHaves):
- The codebase areas touched by the brief are identified and understood well enough to write a grounded spec.
- CI is green on every PR and the acceptance criteria are met. Applicable visual PRs have evidence recorded against their tested head SHA before merge, or backend-only work has a concrete visual-evidence exception.

Build the presentational citation components the chat will use (spec §D4). Props only, no data fetching or wiring. The repo has no Storybook (0 `.stories.` files), so component tests stand in for stories, as the spec decided.
- `CitationMarker` `{ref, active, onSelect}`: a superscript button with an accessible name ("Source 2"), keyboard-activatable.
- `CitationList` `{citations, activeRef, onSelect}`: a numbered footnote list with file name, page and an expandable excerpt. Show a page link only when `fileId` is present: `/api/files/{fileId}/download#page={n}`.
- Build on existing `SourceBadge` styling, the Radix Popover/Collapsible already in deps, and the chat typography tokens. Put them next to `components/chat/messages/source-list.tsx`.
- Export a shared `Citation` display type matching spec §D3's public shape `{ref,fileName,pageNumber,excerpt,fileId?}`.
- New strings go in all four catalogs `apps/web/messages/{en,fr,es,de}.json`, in their own commit. Only add keys; don't touch existing dashboard i18n keys, which Issue Triage owns.

**Acceptance and tests (RTL):**
1. Marker: accessible name, plus Enter/Space and click call `onSelect(ref)`. `active` sets `aria-current`/a visual state.
2. List: renders file, page and excerpt. The page link appears only with `fileId`. An empty list renders nothing. The excerpt toggle is keyboard-operable.
3. Lint, type-check and tests are green locally.

**Planned commits:**
- `feat(chat): add CitationMarker and CitationList components`
- `test(chat): cover citation components`
- `chore(i18n): add citation strings to locale catalogs` (own commit)
Visual evidence: render both components on a scratch page in the local dev server and capture screenshots via agent-browser + `obvious autobuild upload` against the tested head SHA.

**Delivery (release branch):** cut your branch from `origin/release/trustworthy-answers` and open the PR with **base `release/trustworthy-answers`** (draft release PR #575 promotes it to `main`). Never target `main`.
- `test.yml` and `build.yml` only trigger on PRs to `main`, so CI will not run on this PR beyond the conventional-commits check. Before merging, run `npm run lint`, `npm run check-types`, `npm run test` (and `npm run build` where noted) locally and paste the results into the PR body. Merge (squash) into the release branch yourself once they're green and the checks that do run pass.
- Rebase on the latest `release/trustworthy-answers` before merging.

**Spec:** Blueprint `art_DZ3EOoSd` ("Trustworthy answers + two security fixes"). The spec is approved and binding; follow its locked decisions.
**Guardrails:** no new npm dependencies and no CI/workflow or lint/tsconfig changes (AGENTS.md §15). Don't touch anything owned by the Teachanything Issue Triage track: file pipeline/OCR/vision, ratings, dashboard i18n, registration emails, turn lock (#465), account deletion, Common Questions, drift check, Jest ESM migration, quiz-JSON recovery. Jest is ESM: mock with `jest.unstable_mockModule` + dynamic `await import()`.
**PR body footer:** `🔗 [Obvious Project](https://app.obvious.ai/p/teach-anything-platform-research-ACxVZXNN) · 🧵 [Obvious Thread](https://app.obvious.ai/p/teach-anything-platform-research-ACxVZXNN?thread=th_nLy03NKZ) · 🔀 [Obvious PR Artifact](https://app.obvious.ai/prs?prRef=what-is-the-thing-that-we-can-improve-in-the-whole-task:todo_3NJNA2Vt)`
```

## 2. user — 2026-11-13 23:35:48.839 UTC

```text
GitHub PR activity signals batched (2):
• obvious-autobuild[bot] · PR labeled: feat(chat): add CitationMarker and CitationList components (akhileshrangani4/teachanything)
• obvious-autobuild[bot] · PR labeled: feat(chat): add CitationMarker and CitationList components (akhileshrangani4/teachanything)
```

## 3. user — 2026-11-13 23:39:57.794 UTC

```text
## 🎉 PR Merged: [#578 feat(chat): add CitationMarker and CitationList components](https://github.com/akhileshrangani4/teachanything/pull/578)

**Repository:** akhileshrangani4/teachanything
**Author:** @obvious-autobuild[bot]
**Merged:** Nov 13, 11:39 PM
**Changes:** +511 / -0 lines
```
