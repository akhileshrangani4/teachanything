# Task history

> Exported from Obvious on 2026-11-17: every task under root `todo_3NJNA2Vt` (27 tasks including the root), read live with `tasks get` and `tasks list --parentId`. Briefs and completion notes are verbatim.

**Task comments:** `tasks comments.list` answered `NOT_FOUND` for every task in this tree at export time, so no comment bodies could be read from the task API. The user's task comments were also delivered to the orchestration thread as `[Task comment from Akhilesh Rangani]` messages; those are preserved verbatim in [chat/orchestration.md](chat/orchestration.md).

## Task tree

| Task | Id | Status | Assignee |
| --- | --- | --- | --- |
| what is the thing that we can improve in the whole platform? dont tooch what Te… | `todo_3NJNA2Vt` | in_progress | Autobuild Orchestrator |
| ↳ Build sizing | `todo_KxUaPfsx` | completed | none |
| ↳ Plan | `todo_GEiLkVdl` | completed | none |
| ↳ Deliver | `todo_N2P0CpTd` | blocked | none |
| ↳ Research | `todo_buuV6yqT` | completed | none |
| ↳ ↳ Research: product & feature gaps (professor, student, admin surfaces) | `todo_Kew0OkLt` | completed | Agent |
| ↳ ↳ Research: AI tutoring core — RAG retrieval, prompts, models, pedagogy | `todo_Mhuo5Kdu` | completed | Agent |
| ↳ ↳ Research: platform reliability, performance, security & developer experience | `todo_L4ev0Wfu` | completed | Agent |
| ↳ Spec | `todo_jpxLDnaB` | completed | Akhilesh Rangani |
| ↳ Implement | `todo_tN0e9poI` | in_progress | none |
| ↳ Which new track should I spec? | `todo_FtccaMrE` | completed | Akhilesh Rangani |
| ↳ ↳ Which new track should I spec? | `todo_O40skuCg` | completed | Akhilesh Rangani |
| ↳ ↳ Which new track should I spec? | `todo_QEP26UBz` | completed | Akhilesh Rangani |
| ↳ D1: Retrieval & answer evaluation harness | `todo_SE7TN5XZ` | cancelled | Agent |
| ↳ D2: Retrieval precision (top-k, relevance floor, follow-up rewrite, flag-gated rerank) | `todo_674iPBou` | cancelled | Coder |
| ↳ D3: Answer-level citation protocol (server) | `todo_efBI7EHT` | cancelled | Coder |
| ↳ D4a: Citation UI presentational components | `todo_Il0vBNhF` | completed | Agent |
| ↳ D4b: Wire citation footnotes into chat | `todo_IL59x1kp` | cancelled | Coder |
| ↳ S1: Login/registration rate limits use the trusted client IP | `todo_pSA3GxnG` | completed | Agent |
| ↳ S2: App-wide security headers, embed-aware | `todo_ajZ69NUG` | completed | Agent |
| ↳ Save 2 secrets ("OPENAI_API_KEY", "OPENROUTER_API_KEY") | `todo_ZHiBnPwt` | completed | Akhilesh Rangani |
| ↳ Moving Teach Anything research off Obvious | `todo_3luzVCuc` | completed | Akhilesh Rangani |
| ↳ ↳ Moving Teach Anything research off Obvious | `todo_1sWSj1Rj` | completed | Akhilesh Rangani |
| ↳ ↳ Moving Teach Anything research off Obvious | `todo_TaaDxXuH` | completed | Akhilesh Rangani |
| ↳ ↳ Moving Teach Anything research off Obvious | `todo_gZJM8uNS` | completed | Akhilesh Rangani |
| ↳ ↳ Moving Teach Anything research off Obvious | `todo_lPK3F2ry` | completed | Akhilesh Rangani |
| ↳ ↳ Moving Teach Anything research off Obvious | `todo_pfqrXei1` | completed | Akhilesh Rangani |

## what is the thing that we can improve in the whole platform? dont tooch what Te…

- **Id:** `todo_3NJNA2Vt`
- **Parent:** none (root)
- **Status:** in_progress
- **Assignee:** Autobuild Orchestrator (thread `th_nLy03NKZ`, chat: [chat/orchestration.md](chat/orchestration.md))
- **Created:** 2026-11-13 22:59:51.271 UTC
- **Completed:** —

**Brief**

what is the thing that we can improve in the whole platform? dont tooch what Teachanything Issue Triage is working on. this is a new ventured track that we can maybe land, some new fetures or improvements

**Completion note**

*(none)*

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## Build sizing

- **Id:** `todo_KxUaPfsx`
- **Parent:** `todo_3NJNA2Vt`
- **Status:** completed
- **Assignee:** none
- **Created:** 2026-11-13 22:59:51.516 UTC
- **Completed:** —

**Brief**

Restate the request as a client-readable brief before anything else. Search workspace artifacts, memory, and prior threads for context. If it is too vague to act on, ask the user targeted questions instead of guessing.

Once you understand the problem, classify the work as "small" (no more than one PR) or "large" (anything more than one PR). You can take shortcuts with small tasks.

**Completion note**

*(none)*

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## Plan

- **Id:** `todo_GEiLkVdl`
- **Parent:** `todo_3NJNA2Vt`
- **Status:** completed
- **Assignee:** none
- **Created:** 2026-11-13 22:59:51.997 UTC
- **Completed:** 2026-11-13 23:22:43.335 UTC

**Brief**

The spec is already approved; this loop has no plan approval. Create the subtasks directly with `obvious tasks create` rather than proposing them with propose-plan, then continue to Implement.

The task tree is the plan: its subtasks and dependencies are what runs.
- Consume the spec; do not rewrite it. Start from its locked decisions, verification criteria and risks, and reopen it only for a material contradiction.
- One subtask per PR-sized concern, grouped by capability rather than by file. Each description states its acceptance criterion, the tests that verify it, and its planned commits (conventional prefixes; generated files and snapshots in their own commits).
- Order with dependencies, not prose: a dependent subtask starts when its prerequisites complete and everything else runs in parallel. When two subtasks would edit the same files, add an edge or merge them.
- For new UI, the first subtask is the presentational components and their stories; API, state and backend wiring depend on it.
- Deliver the way the spec decided. Where it is silent, two or more related PRs take a release branch (Branch and release). For a release branch, load `autobuild-release` and set it up before any child starts.
- Name a branch for each code subtask when you start it; it links the eventual PR to the task.
- Set each subtask complexity to its difficulty: low for trivial mechanical edits, standard for normal fixes and features, high for cross-cutting, algorithmic or design-sensitive work. The model is fixed at spawn, so judge an unclear task before fanning out; uniform complexity across different tasks is a smell.
- Confirm the DAG matches the spec: every deliverable maps to planned work, and nothing planned falls outside it.

**Completion note**

7 coder subtasks: D1 eval harness (high) → D2 retrieval precision (high) → D3 citation protocol (high) → D4b citation wiring (standard, also after D4a); D4a citation components (standard) parallel; S1 trusted-IP auth limits (low) and S2 security headers (standard) as independent PRs to main. Release branch release/trustworthy-answers + draft PR #575 set up and declared on the root.

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## Deliver

- **Id:** `todo_N2P0CpTd`
- **Parent:** `todo_3NJNA2Vt`
- **Status:** blocked
- **Assignee:** none
- **Created:** 2026-11-13 22:59:51.997 UTC
- **Completed:** —

**Brief**

Verify outcomes against the spec acceptance criteria, then report results: what shipped, where, and what remains.

**Completion note**

*(none)*

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## Research

- **Id:** `todo_buuV6yqT`
- **Parent:** `todo_3NJNA2Vt`
- **Status:** completed
- **Assignee:** none
- **Created:** 2026-11-13 22:59:51.997 UTC
- **Completed:** 2026-11-13 23:08:52.443 UTC

**Brief**

Read-only exploration of the repository when it is unfamiliar: map the relevant modules, conventions, and existing patterns. No code changes in this stage.

**Completion note**

Three read-only research docs (art_GFoVZKhr product, art_0xSIXg3p AI core, art_ktM9QU8j platform health) map 15 ranked candidates with code citations; none overlaps the Issue Triage track.

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## Research: product & feature gaps (professor, student, admin surfaces)

- **Id:** `todo_Kew0OkLt`
- **Parent:** `todo_buuV6yqT`
- **Status:** completed
- **Assignee:** Agent (thread `th_eIDtGcR6`, chat: [chat/research-product-gaps.md](chat/research-product-gaps.md))
- **Created:** 2026-11-13 23:01:09.068 UTC
- **Completed:** —

**Brief**

Outcome: a ranked map of the highest-value NEW features and UX improvements for Teach Anything, grounded in what the product does today.
- Map every user-facing surface in apps/web: professor dashboard (chatbot creation/config, file management, sharing/embedding, analytics), student chat experience (public/embedded chat, history, quizzes, citations), admin console (approvals, user mgmt). Note what each supports and where flows dead-end or are clearly half-built (TODOs, feature flags, unused routes, stubbed components).
- Read the open issue backlog for feature requests not owned by the off-limits track.
- Candidates to evaluate (confirm or reject from code, don't assume): chatbot templates/duplication, student conversation export, LMS integration (LTI/Canvas), embed widget customization, professor-side conversation review, onboarding, course/section grouping, scheduled availability, accessibility gaps.

---
Repo: akhileshrangani4/teachanything (repo sandbox cmp_m3rUfWXx), base `main`. Cut nothing; this is READ-ONLY research: no edits, no branch, no PR, no GitHub comments.

Context: the user asked "what can we improve in the whole platform — new features or improvements — as a new track". A separate track ("Teachanything Issue Triage") is already working on these, so they are OFF-LIMITS: do not propose anything that overlaps them:
- File pipeline: image OCR (#561, #126 phase 1), scanned-PDF OCR (#126 phase 2), OpenRouter vision after OCR (#550, #129), run tokens/refresh visibility for file jobs (#462), failed QStash publish retry (#463), RTF uploads (#128)
- Response ratings / student feedback on answers + professor views (#559)
- Dashboard i18n (#560, #540) and locale catalogs
- Registration emails (#136, #340)
- Chat single-turn-per-session lock (#465)
- Account deletion fail-closed (#464)
- Anonymous account-status endpoint removal (#480)
- Common Questions grouping normalization (#315)
- Schema-drift deploy check (#515)
- Jest ESM guidance / inert mocks (#399)
- Quiz-JSON leak recovery (#398)
- #131, #137 (closed / on hold)
Run `gh issue list --state open --limit 200` and `gh pr list --state open` to see the current backlog; anything not in the list above is fair game, but say which issue number backs a finding.

Grounding rules: every finding cites file paths (and line ranges where useful) you actually read. Separate "observed in code" from "inferred". No invented metrics. For each candidate improvement give: what it is, user-visible value (who benefits: professor / student / admin / operator), evidence in code, rough size (S ≤1 PR / M 2–3 PRs / L more), risks, and overlap check against the off-limits list.

Deliverable: publish ONE findings document in this project with `obvious artifacts create --type=document` (draft in /home/user/work, pipe with `--stdin=content`). Structure: 1) one-paragraph map of the areas you explored, 2) ranked top 5 candidates with the fields above, 3) a "considered and rejected" list with one-line reasons, 4) open questions. Report the artifact id in your success report.

**Completion note**

Findings in art_GFoVZKhr: embed appearance, starter questions, duplicate chatbot, quiz analytics, chat resume.

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## Research: AI tutoring core — RAG retrieval, prompts, models, pedagogy

- **Id:** `todo_Mhuo5Kdu`
- **Parent:** `todo_buuV6yqT`
- **Status:** completed
- **Assignee:** Agent (thread `th_9a6BvAqr`, chat: [chat/research-ai-tutoring-core.md](chat/research-ai-tutoring-core.md))
- **Created:** 2026-11-13 23:01:10.095 UTC
- **Completed:** —

**Brief**

Outcome: a ranked list of improvements to answer quality, grounding and pedagogy in the AI core (packages/ai and the chat streaming path in apps/web).
- Map the RAG pipeline end to end: chunking, embeddings (model, dimensions, pgvector index type), retrieval query (top-k, filters, hybrid with pg_trgm?), reranking, context assembly, citations back to source files, system prompt construction, tool calls (quizzes etc.), model selection via OpenRouter, fallbacks, token/cost limits.
- Identify concrete gaps: e.g. missing hybrid search or reranking, no citation/source display, no eval harness for retrieval quality, no per-chatbot cost/token budget, conversation memory/summarization limits, Socratic/hint modes, guardrails against answer-dumping on graded work.
- Do not touch the quiz-JSON leak recovery (#398) or the single-turn lock (#465); building on top of them is fine if noted.

---
Repo: akhileshrangani4/teachanything (repo sandbox cmp_m3rUfWXx), base `main`. Cut nothing; this is READ-ONLY research: no edits, no branch, no PR, no GitHub comments.

Context: the user asked "what can we improve in the whole platform — new features or improvements — as a new track". A separate track ("Teachanything Issue Triage") is already working on these, so they are OFF-LIMITS: do not propose anything that overlaps them:
- File pipeline: image OCR (#561, #126 phase 1), scanned-PDF OCR (#126 phase 2), OpenRouter vision after OCR (#550, #129), run tokens/refresh visibility for file jobs (#462), failed QStash publish retry (#463), RTF uploads (#128)
- Response ratings / student feedback on answers + professor views (#559)
- Dashboard i18n (#560, #540) and locale catalogs
- Registration emails (#136, #340)
- Chat single-turn-per-session lock (#465)
- Account deletion fail-closed (#464)
- Anonymous account-status endpoint removal (#480)
- Common Questions grouping normalization (#315)
- Schema-drift deploy check (#515)
- Jest ESM guidance / inert mocks (#399)
- Quiz-JSON leak recovery (#398)
- #131, #137 (closed / on hold)
Run `gh issue list --state open --limit 200` and `gh pr list --state open` to see the current backlog; anything not in the list above is fair game, but say which issue number backs a finding.

Grounding rules: every finding cites file paths (and line ranges where useful) you actually read. Separate "observed in code" from "inferred". No invented metrics. For each candidate improvement give: what it is, user-visible value (who benefits: professor / student / admin / operator), evidence in code, rough size (S ≤1 PR / M 2–3 PRs / L more), risks, and overlap check against the off-limits list.

Deliverable: publish ONE findings document in this project with `obvious artifacts create --type=document` (draft in /home/user/work, pipe with `--stdin=content`). Structure: 1) one-paragraph map of the areas you explored, 2) ranked top 5 candidates with the fields above, 3) a "considered and rejected" list with one-line reasons, 4) open questions. Report the artifact id in your success report.

**Completion note**

Findings in art_0xSIXg3p: eval harness, retrieval precision, answer-level citations, tutoring modes, token metering.

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## Research: platform reliability, performance, security & developer experience

- **Id:** `todo_L4ev0Wfu`
- **Parent:** `todo_buuV6yqT`
- **Status:** completed
- **Assignee:** Agent (thread `th_JF7nohUZ`, chat: [chat/research-platform-health.md](chat/research-platform-health.md))
- **Created:** 2026-11-13 23:01:11.120 UTC
- **Completed:** —

**Brief**

Outcome: a ranked list of non-feature platform improvements: performance, observability, security hardening, cost controls, test/CI infrastructure, DX.
- Map: tRPC routers and their auth/authorization checks (IDOR risks on chatbot/file/conversation ids), rate limiting coverage (Redis optional), logging/observability (logWarn/logError, error tracking, any Sentry/OTel), DB query hot paths and missing indexes, caching, Next.js rendering/perf (bundle size, server components), background jobs (QStash) beyond the file pipeline, CI workflows and test coverage gaps.
- Known flagged-but-unfixed items from the other track you may evaluate (they are NOT owned by it): DB-backed tests skip in CI because there is no Postgres (PGlite or a service container was proposed; note AGENTS.md section 15 rules on tool config), packages/db/scripts/seed.ts writes credential rows with account_id = email so seeded demo logins fail on Better Auth 1.7.5, no admin router test for deleteUser error mapping.
- Read AGENTS.md and CONTRIBUTING.md first for conventions and constraints.

---
Repo: akhileshrangani4/teachanything (repo sandbox cmp_m3rUfWXx), base `main`. Cut nothing; this is READ-ONLY research: no edits, no branch, no PR, no GitHub comments.

Context: the user asked "what can we improve in the whole platform — new features or improvements — as a new track". A separate track ("Teachanything Issue Triage") is already working on these, so they are OFF-LIMITS: do not propose anything that overlaps them:
- File pipeline: image OCR (#561, #126 phase 1), scanned-PDF OCR (#126 phase 2), OpenRouter vision after OCR (#550, #129), run tokens/refresh visibility for file jobs (#462), failed QStash publish retry (#463), RTF uploads (#128)
- Response ratings / student feedback on answers + professor views (#559)
- Dashboard i18n (#560, #540) and locale catalogs
- Registration emails (#136, #340)
- Chat single-turn-per-session lock (#465)
- Account deletion fail-closed (#464)
- Anonymous account-status endpoint removal (#480)
- Common Questions grouping normalization (#315)
- Schema-drift deploy check (#515)
- Jest ESM guidance / inert mocks (#399)
- Quiz-JSON leak recovery (#398)
- #131, #137 (closed / on hold)
Run `gh issue list --state open --limit 200` and `gh pr list --state open` to see the current backlog; anything not in the list above is fair game, but say which issue number backs a finding.

Grounding rules: every finding cites file paths (and line ranges where useful) you actually read. Separate "observed in code" from "inferred". No invented metrics. For each candidate improvement give: what it is, user-visible value (who benefits: professor / student / admin / operator), evidence in code, rough size (S ≤1 PR / M 2–3 PRs / L more), risks, and overlap check against the off-limits list.

Deliverable: publish ONE findings document in this project with `obvious artifacts create --type=document` (draft in /home/user/work, pipe with `--stdin=content`). Structure: 1) one-paragraph map of the areas you explored, 2) ranked top 5 candidates with the fields above, 3) a "considered and rejected" list with one-line reasons, 4) open questions. Report the artifact id in your success report.

**Completion note**

Findings in art_ktM9QU8j: spoofable-IP rate limiting, broken demo seed, CI DB + authz tests, observability, security headers.

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## Spec

- **Id:** `todo_jpxLDnaB`
- **Parent:** `todo_3NJNA2Vt`
- **Status:** completed
- **Assignee:** Akhilesh Rangani (`usr_DDIXh3Sc`)
- **Created:** 2026-11-13 22:59:51.997 UTC
- **Completed:** 2026-11-13 23:19:32.085 UTC

**Brief**

Write the Blueprint spec with verifiable acceptance criteria. Every deliverable gets acceptance criteria, including tests where code is produced. Record the delivery in the locked decisions: one PR, independent PRs, or a release branch. Two or more related PRs take a release branch, and so does any set that must land together. If research surfaced ambiguity or material trade-offs, ask the user an informed question — with your recommendation — before writing the spec; when the picture is clear, proceed. Once the spec is saved, complete this stage with a one-line summary of the blueprint as the completion note: the user approves the spec at this stage before planning starts. If they comment asking for changes, revise the same blueprint and complete the stage again.

**Completion note**

Spec art_DZ3EOoSd: eval harness (D1) → top-k + relevance floor + follow-up rewrite + flag-gated rerank (D2) → [n] citation protocol (D3) + footnote UI (D4) on release/trustworthy-answers; S1 trusted-IP auth limits and S2 embed-aware security headers as independent PRs to main.

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## Implement

- **Id:** `todo_tN0e9poI`
- **Parent:** `todo_3NJNA2Vt`
- **Status:** in_progress
- **Assignee:** none
- **Created:** 2026-11-13 22:59:51.997 UTC
- **Completed:** —

**Brief**

Execute the plan: one PR per subtask, conventional commits, lint and tests green before reporting done. Each coder owns its PR end-to-end. For a PR that changes rendered UI, visual state, or an interactive workflow, dogfood the change with agent-browser before merge. Capture a screenshot for a static visual result, and before/after screenshots plus a short WebM recording for an interaction. Submit each acceptance criterion through `obvious autobuild upload` against the tested head SHA — load the autobuild-qa skill first; it owns capture and submission rules — so Obvious records canonical evidence and can attach supported media to the PR. For backend-only work, state the concrete reason visual evidence is not applicable. Once the applicable evidence is recorded, merge or report ready for approval according to workspace policy. Trust it on process state (CI, checks, mergeability), redirect it via `obvious tasks steer` if it reports a blocker. Deliverable acceptance stays yours: verify results against the spec acceptance criteria before advancing a task.

**Completion note**

*(none)*

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## Which new track should I spec?

- **Id:** `todo_FtccaMrE`
- **Parent:** `todo_3NJNA2Vt`
- **Status:** completed
- **Assignee:** Akhilesh Rangani (`usr_DDIXh3Sc`)
- **Created:** 2026-11-13 23:09:02.831 UTC
- **Completed:** 2026-11-13 23:10:57.788 UTC

**Brief**

*(no brief)*

**Completion note**

*(none)*

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## Which new track should I spec?

- **Id:** `todo_O40skuCg`
- **Parent:** `todo_FtccaMrE`
- **Status:** completed
- **Assignee:** Akhilesh Rangani (`usr_DDIXh3Sc`)
- **Created:** 2026-11-13 23:09:02.831 UTC
- **Completed:** 2026-11-13 23:10:57.463 UTC

**Brief**

*(no brief)*

**Completion note**

*(none)*

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## Which new track should I spec?

- **Id:** `todo_QEP26UBz`
- **Parent:** `todo_FtccaMrE`
- **Status:** completed
- **Assignee:** Akhilesh Rangani (`usr_DDIXh3Sc`)
- **Created:** 2026-11-13 23:09:02.831 UTC
- **Completed:** 2026-11-13 23:10:57.794 UTC

**Brief**

*(no brief)*

**Completion note**

*(none)*

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## D1: Retrieval & answer evaluation harness

- **Id:** `todo_SE7TN5XZ`
- **Parent:** `todo_3NJNA2Vt`
- **Status:** cancelled
- **Assignee:** Agent (thread `th_8BBfSr68`, chat: [chat/d1-eval-harness.md](chat/d1-eval-harness.md))
- **Created:** 2026-11-13 23:22:25.987 UTC
- **Completed:** —

**Brief**

Build an offline, repeatable evaluation harness that measures retrieval quality and answer grounding, and commit a baseline for today's behavior (spec §D1).
- Corpus: 2–4 permissively licensed course docs (license and attribution in `apps/web/eval/fixtures/README.md`). At least one is a multi-page PDF. At most 300 chunks. Chunk with the real `RAGService` chunker.
- `golden.json`: at least 50 cases. At least 30 answerable with `{fileName,pageNumber,mustContain}` anchors, at least 8 follow-ups (with `history`), at least 6 exact-detail (#271-style), at least 6 off-topic (`expected: []`).
- Embedding cache: base64 float32 keyed by text hash, so retrieval mode needs only Postgres+pgvector. A cache miss without credentials fails and names the hash.
- `npm run eval:retrieval -w apps/web` (gated on `TEST_DATABASE_URL`): load the fixtures, call the real `buildRAGContext`/`hybridSearch`, and report recall@injected, MRR, median/p95 injected tokens, off-topic false-injection rate and p50/p95 latency to `eval/reports/`. `--compare eval/baseline.json` exits 1 on regression.
- `npm run eval:answers`: opt-in, needs the OpenRouter key. Scores citation validity, cited-source precision, and the denial rate on answerable questions.
- Pure metric and scoring modules in `apps/web/src/server/eval/`.
- Postgres + pgvector are not preinstalled on the repo sandbox. Install them locally (apt, or docker if present) for `TEST_DATABASE_URL`.

**Credentials:** when the project has secrets `OPENAI_API_KEY` (embeddings) or `OPENROUTER_API_KEY` (chat models), inject them with `secretsToInject: ["SECRET_OPENAI_API_KEY"]` / `["SECRET_OPENROUTER_API_KEY"]` and map them to the env names the app reads. Never print or commit them. If a step needs a key that isn't configured, finish everything else, push, and report `needs_input` naming the exact key and the step it blocks. Don't fake embeddings or model output to get around it.

**Acceptance:**
1. `eval/baseline.json` is committed from current behavior, and the PR quotes recall, MRR and median/p95 tokens.
2. Two runs on the same commit give identical recall, MRR and token counts (latency excluded).
3. Unit tests cover recall/MRR including the off-topic empty case, anchor matching across a chunk-boundary shift, `--compare` tolerance logic, and citation-validity scoring on recorded transcripts.
4. Without `TEST_DATABASE_URL` the runner exits non-zero with a clear message, and `npm run test` is unaffected.
5. `git diff package-lock.json` is empty.

**Tests:** `apps/web/src/__tests__/server/eval/*.test.ts` (CI-safe, no DB), plus a recorded double-run of `eval:retrieval`.
**Planned commits:**
- `feat(eval): add retrieval and answer metric modules with tests`
- `feat(eval): add fixture corpus and golden set`
- `chore(eval): add generated embedding cache` (own commit)
- `feat(eval): add retrieval runner and npm script`
- `feat(eval): add opt-in answer mode`
- `chore(eval): commit baseline report` (own commit)
Backend/tooling only: no visual evidence; say so in the PR.

**Delivery (release branch):** cut your branch from `origin/release/trustworthy-answers` and open the PR with **base `release/trustworthy-answers`** (draft release PR #575 promotes it to `main`). Never target `main`.
- `test.yml` and `build.yml` only trigger on PRs to `main`, so CI will not run on this PR beyond the conventional-commits check. Before merging, run `npm run lint`, `npm run check-types`, `npm run test` (and `npm run build` where noted) locally and paste the results into the PR body. Merge (squash) into the release branch yourself once they're green and the checks that do run pass.
- Rebase on the latest `release/trustworthy-answers` before merging.

**Spec:** Blueprint `art_DZ3EOoSd` ("Trustworthy answers + two security fixes"). The spec is approved and binding; follow its locked decisions.
**Guardrails:** no new npm dependencies and no CI/workflow or lint/tsconfig changes (AGENTS.md §15). Don't touch anything owned by the Teachanything Issue Triage track: file pipeline/OCR/vision, ratings, dashboard i18n, registration emails, turn lock (#465), account deletion, Common Questions, drift check, Jest ESM migration, quiz-JSON recovery. Jest is ESM: mock with `jest.unstable_mockModule` + dynamic `await import()`.
**PR body footer:** `🔗 [Obvious Project](https://app.obvious.ai/p/teach-anything-platform-research-ACxVZXNN) · 🧵 [Obvious Thread](https://app.obvious.ai/p/teach-anything-platform-research-ACxVZXNN?thread=th_nLy03NKZ) · 🔀 [Obvious PR Artifact](https://app.obvious.ai/prs?prRef=what-is-the-thing-that-we-can-improve-in-the-whole-task:todo_3NJNA2Vt)`

**Completion note**

Stopped at user request (HALT).

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## D2: Retrieval precision (top-k, relevance floor, follow-up rewrite, flag-gated rerank)

- **Id:** `todo_674iPBou`
- **Parent:** `todo_3NJNA2Vt`
- **Status:** cancelled
- **Assignee:** Coder (`coder`)
- **Created:** 2026-11-13 23:22:26.356 UTC
- **Completed:** —
- **Depends on:** `todo_SE7TN5XZ`

**Brief**

Inject a small, relevance-gated set of passages instead of filling the context window, and prove it with the D1 harness against the committed baseline (spec §D2).
- `buildRAGContext` takes `min(budgetLimit, RAG_TOP_K)`. Choose `RAG_TOP_K` from an eval sweep over {8,12,16,24} and put the sweep table in the PR.
- `applyRelevanceFloor`: drop fused candidates whose vector similarity is below `RAG_MIN_SIMILARITY`, unless they also ranked in the full-text top results. Choose the value from the off-topic vs answerable curve.
- `rewriteFollowUp`: only when there is a prior exchange. Uses the chatbot's model through the existing OpenRouter client, with a 1.5 s timeout and at most 64 output tokens. Fall back to the raw message on timeout, error or empty output. Never shown to the user or persisted except in timing.
- `Reranker` interface: `none` (default) and `llm`, selected by env `RAG_RERANK=llm`. The default flips to `llm` only if recall@injected gains at least 3 points with added p95 latency of at most 800 ms. Otherwise record why it stays off.
- Fix `AVG_CHUNK_TOKENS` to 250 (1000-char chunks / 4).
- No pg_trgm retriever (#516).

**Credentials:** when the project has secrets `OPENAI_API_KEY` (embeddings) or `OPENROUTER_API_KEY` (chat models), inject them with `secretsToInject: ["SECRET_OPENAI_API_KEY"]` / `["SECRET_OPENROUTER_API_KEY"]` and map them to the env names the app reads. Never print or commit them. If a step needs a key that isn't configured, finish everything else, push, and report `needs_input` naming the exact key and the step it blocks. Don't fake embeddings or model output to get around it.

**Acceptance (eval vs D1 baseline, numbers in the PR):**
1. recall@injected on answerable+exact is at least 0.85 and at most 3 points below baseline.
2. Median injected tokens fall by at least 60%.
3. At least 80% of off-topic cases inject zero passages.
4. Follow-up recall@injected improves over baseline.
5. Answer-mode denial rate is no higher than baseline, or the PR explicitly states it could not run.

**Tests:**
- `applyRelevanceFloor` unit tests: drops vector-only low rows, keeps FTS-ranked rows, returns empty when nothing qualifies.
- `rewriteFollowUp`: no history → no call; timeout, error and empty output all fall back (fake timers, mocked client).
- `buildRAGContext` never exceeds `RAG_TOP_K`.
- Reranker: `none` is identity, the env switch selects `llm`, and an llm failure falls back to input order.
- `AVG_CHUNK_TOKENS` is pinned to chunkSize / `CHARS_PER_TOKEN`.
- `eval:retrieval --compare eval/baseline.json` passes.

**Planned commits:**
- `fix(ai): align AVG_CHUNK_TOKENS with 1000-char chunks`
- `feat(rag): cap injected context at RAG_TOP_K with relevance floor`
- `feat(rag): rewrite follow-up questions into standalone queries`
- `feat(rag): add pluggable reranker with flag-gated llm implementation`
- `chore(eval): update eval report` (own commit)
Backend only: no visual evidence; say so in the PR.

**Delivery (release branch):** cut your branch from `origin/release/trustworthy-answers` and open the PR with **base `release/trustworthy-answers`** (draft release PR #575 promotes it to `main`). Never target `main`.
- `test.yml` and `build.yml` only trigger on PRs to `main`, so CI will not run on this PR beyond the conventional-commits check. Before merging, run `npm run lint`, `npm run check-types`, `npm run test` (and `npm run build` where noted) locally and paste the results into the PR body. Merge (squash) into the release branch yourself once they're green and the checks that do run pass.
- Rebase on the latest `release/trustworthy-answers` before merging.

**Spec:** Blueprint `art_DZ3EOoSd` ("Trustworthy answers + two security fixes"). The spec is approved and binding; follow its locked decisions.
**Guardrails:** no new npm dependencies and no CI/workflow or lint/tsconfig changes (AGENTS.md §15). Don't touch anything owned by the Teachanything Issue Triage track: file pipeline/OCR/vision, ratings, dashboard i18n, registration emails, turn lock (#465), account deletion, Common Questions, drift check, Jest ESM migration, quiz-JSON recovery. Jest is ESM: mock with `jest.unstable_mockModule` + dynamic `await import()`.
**PR body footer:** `🔗 [Obvious Project](https://app.obvious.ai/p/teach-anything-platform-research-ACxVZXNN) · 🧵 [Obvious Thread](https://app.obvious.ai/p/teach-anything-platform-research-ACxVZXNN?thread=th_nLy03NKZ) · 🔀 [Obvious PR Artifact](https://app.obvious.ai/prs?prRef=what-is-the-thing-that-we-can-improve-in-the-whole-task:todo_3NJNA2Vt)`

**Completion note**

Stopped at user request (HALT) before starting.

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## D3: Answer-level citation protocol (server)

- **Id:** `todo_efBI7EHT`
- **Parent:** `todo_3NJNA2Vt`
- **Status:** cancelled
- **Assignee:** Coder (`coder`)
- **Created:** 2026-11-13 23:22:26.567 UTC
- **Completed:** —
- **Depends on:** `todo_674iPBou`

**Brief**

Have the model cite numbered passages and resolve those refs server-side into the sources the answer actually used (spec §D3). Depends on D2 because both edit `rag-context.ts` and `format-passage.ts`.
- `formatPassage` emits `[n] {fileName}, p. {page}`, or `part {chunkIndex+1}` when there is no page. Refs are per turn: injected passages first, then `search_documents` results, which gain a `ref` field. A repeated passage keeps its first ref.
- Replace the "Do NOT put inline citations" grounding rule and the `done` tool's "cite file and page" with ONE instruction: mark claims with [n] / [n, m], use only given numbers, never invent pages or file names.
- Pure `extractCitations(text, refTable)`: handles [n], [n, m] and [n][m], ignores code spans, returns first-use order, drops unknown refs with one count-only `logWarn`.
- Persist `metadata.citations` (`{ref,fileName,chunkIndex,pageNumber,excerpt,fileId?}`) alongside the unchanged `sources`. Update the schema type only; no migration.
- Stream payload: send `citations` only when `showSources` is true, as `{ref,fileName,pageNumber,excerpt≤280 chars at a word boundary}`. Add `fileId` only on owner-authenticated surfaces. Public payloads never include chunkIndex, fileId or similarity. No valid refs → `citations: []`.
- The retrieval-tool-results privacy rule in `stream-chat.ts` still holds for everything except cited excerpts.

**Credentials:** when the project has secrets `OPENAI_API_KEY` (embeddings) or `OPENROUTER_API_KEY` (chat models), inject them with `secretsToInject: ["SECRET_OPENAI_API_KEY"]` / `["SECRET_OPENROUTER_API_KEY"]` and map them to the env names the app reads. Never print or commit them. If a step needs a key that isn't configured, finish everything else, push, and report `needs_input` naming the exact key and the step it blocks. Don't fake embeddings or model output to get around it.

**Acceptance and tests:**
1. `extractCitations` unit tests: single, list and adjacent refs; unknown refs; code spans; duplicates; none.
2. A prompt-assembly test: the grounding rule and the `done` description carry the same citation instruction, and neither contains "Do NOT put inline citations".
3. `formatPassage` header tests, including the no-page fallback.
4. A turn-level test (mocked model, `cut-off-turn.test.ts` pattern): an answer citing [2] persists exactly one citation matching passage 2, with `sources` unchanged.
5. Privacy tests: public payload with showSources=false has no `citations` key. With showSources=true it has no chunkIndex, fileId or similarity, and every excerpt is at most 280 chars.
6. `eval:answers` citation validity is at least 95% on the default model, or the PR states it was not run (no key).
7. `eval:retrieval --compare` still passes.

**Planned commits:**
- `feat(chat): number passages with refs and page numbers`
- `feat(chat): unify citation instruction across grounding rule and done tool`
- `feat(chat): resolve [n] refs into message citations`
- `feat(chat): expose privacy-scoped citations in stream metadata`
Backend only: no visual evidence; say so in the PR.

**Delivery (release branch):** cut your branch from `origin/release/trustworthy-answers` and open the PR with **base `release/trustworthy-answers`** (draft release PR #575 promotes it to `main`). Never target `main`.
- `test.yml` and `build.yml` only trigger on PRs to `main`, so CI will not run on this PR beyond the conventional-commits check. Before merging, run `npm run lint`, `npm run check-types`, `npm run test` (and `npm run build` where noted) locally and paste the results into the PR body. Merge (squash) into the release branch yourself once they're green and the checks that do run pass.
- Rebase on the latest `release/trustworthy-answers` before merging.

**Spec:** Blueprint `art_DZ3EOoSd` ("Trustworthy answers + two security fixes"). The spec is approved and binding; follow its locked decisions.
**Guardrails:** no new npm dependencies and no CI/workflow or lint/tsconfig changes (AGENTS.md §15). Don't touch anything owned by the Teachanything Issue Triage track: file pipeline/OCR/vision, ratings, dashboard i18n, registration emails, turn lock (#465), account deletion, Common Questions, drift check, Jest ESM migration, quiz-JSON recovery. Jest is ESM: mock with `jest.unstable_mockModule` + dynamic `await import()`.
**PR body footer:** `🔗 [Obvious Project](https://app.obvious.ai/p/teach-anything-platform-research-ACxVZXNN) · 🧵 [Obvious Thread](https://app.obvious.ai/p/teach-anything-platform-research-ACxVZXNN?thread=th_nLy03NKZ) · 🔀 [Obvious PR Artifact](https://app.obvious.ai/prs?prRef=what-is-the-thing-that-we-can-improve-in-the-whole-task:todo_3NJNA2Vt)`

**Completion note**

Stopped at user request (HALT) before starting.

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## D4a: Citation UI presentational components

- **Id:** `todo_Il0vBNhF`
- **Parent:** `todo_3NJNA2Vt`
- **Status:** completed
- **Assignee:** Agent (thread `th_amj4awr3`, chat: [chat/d4a-citation-ui.md](chat/d4a-citation-ui.md))
- **Created:** 2026-11-13 23:22:26.751 UTC
- **Completed:** 2026-11-13 23:40:04.954 UTC

**Brief**

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

**Completion note**

Merged: https://github.com/akhileshrangani4/teachanything/pull/578 (squash 30be5a2 into release/trustworthy-answers, 2026-11-13T23:39:54Z). D4a adds presentational CitationMarker + CitationList next to source-list.tsx, the shared Citation type ({ref,fileName,pageNumber?,excerpt,fileId?}) and citationFileHref in lib/message-sources.ts, and 6 chat.citations keys in en/fr/es/de (own commit 486f732; additions only). One deviation, documented in the PR: the marker prop is refNumber, not ref, because React reserves ref on components; CitationList keeps activeRef. Page link renders only when fileId is present (owner-only, locked decision 6). Local results on Node 24 at ca87038 (CI does not run on release-branch PRs): lint pass (0 warnings), check-types pass, tests web 1381 passed/12 skipped, ai 81, db 44; package-lock unchanged. GitHub checks that ran: 11 passed, 2 skipped, 0 failed. Visual evidence uploaded against ca87038: tc-1 (list renders file/page/folded excerpt; page link only for the fileId citation; empty list renders nothing) and tc-2 (Enter on marker 2 sets aria-current on marker and footnote; Enter on its toggle opens the excerpt; before/after PNG + WebM). Environment note: the repo sandbox's node_modules was stale and root-owned on Node 20, so I chowned it and ran npm ci on Node 24 from the existing lockfile; no dependency changes. A pre-existing untracked bun.lock was left untouched. PR artifact: art_6tKd6ZEz.

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## D4b: Wire citation footnotes into chat

- **Id:** `todo_IL59x1kp`
- **Parent:** `todo_3NJNA2Vt`
- **Status:** cancelled
- **Assignee:** Coder (`coder`)
- **Created:** 2026-11-13 23:22:26.931 UTC
- **Completed:** —
- **Depends on:** `todo_efBI7EHT`, `todo_Il0vBNhF`

**Brief**

Render D3's citations in chat using D4a's components, so students and professors see which passage backs each claim (spec §D4).
- `ChatMessage`: render `[n]` as `CitationMarker` via a react-markdown text transform, including mid-stream. A partial `[1` must not crash.
- Marker click highlights and scrolls to its footnote.
- showSources on + citations → `CitationList` replaces `SourceList`. showSources on + no citations → `SourceList` exactly as today. showSources off → markers stripped from rendered text, copy and export of that message.
- Thread `citations` from message metadata on public chat, embed window, dashboard preview and Student Chats. `fileId` page links appear only on owner surfaces.

**Credentials:** when the project has secrets `OPENAI_API_KEY` (embeddings) or `OPENROUTER_API_KEY` (chat models), inject them with `secretsToInject: ["SECRET_OPENAI_API_KEY"]` / `["SECRET_OPENROUTER_API_KEY"]` and map them to the env names the app reads. Never print or commit them. If a step needs a key that isn't configured, finish everything else, push, and report `needs_input` naming the exact key and the step it blocks. Don't fake embeddings or model output to get around it.

**Acceptance and tests:**
1. `ChatMessage` tests:
   - sources on + citations → markers and footnotes, no badge list
   - sources on + no citations → today's badge list
   - sources off → no markers or brackets in the text
   - a partial streamed `[1` resolves once complete
2. Copy/export strip test with sources off.
3. agent-browser QA on a local dev server with the D1 eval corpus loaded:
   - public chat answer with markers and footnotes (screenshot)
   - marker click focuses its footnote (WebM)
   - owner preview page link opens the PDF at the page (screenshot)
   - showSources off shows clean prose (screenshot)
   Submit via `obvious autobuild upload` against the tested head SHA. Live answers need the OpenRouter key. Without it, QA with conversations seeded with citation metadata and state the gap.
4. `npm run build` is green locally.

**Planned commits:**
- `feat(chat): render citation markers and footnotes in ChatMessage`
- `feat(chat): strip citation markers when sources are hidden`
- `test(chat): cover citation rendering states`

**Delivery (release branch):** cut your branch from `origin/release/trustworthy-answers` and open the PR with **base `release/trustworthy-answers`** (draft release PR #575 promotes it to `main`). Never target `main`.
- `test.yml` and `build.yml` only trigger on PRs to `main`, so CI will not run on this PR beyond the conventional-commits check. Before merging, run `npm run lint`, `npm run check-types`, `npm run test` (and `npm run build` where noted) locally and paste the results into the PR body. Merge (squash) into the release branch yourself once they're green and the checks that do run pass.
- Rebase on the latest `release/trustworthy-answers` before merging.

**Spec:** Blueprint `art_DZ3EOoSd` ("Trustworthy answers + two security fixes"). The spec is approved and binding; follow its locked decisions.
**Guardrails:** no new npm dependencies and no CI/workflow or lint/tsconfig changes (AGENTS.md §15). Don't touch anything owned by the Teachanything Issue Triage track: file pipeline/OCR/vision, ratings, dashboard i18n, registration emails, turn lock (#465), account deletion, Common Questions, drift check, Jest ESM migration, quiz-JSON recovery. Jest is ESM: mock with `jest.unstable_mockModule` + dynamic `await import()`.
**PR body footer:** `🔗 [Obvious Project](https://app.obvious.ai/p/teach-anything-platform-research-ACxVZXNN) · 🧵 [Obvious Thread](https://app.obvious.ai/p/teach-anything-platform-research-ACxVZXNN?thread=th_nLy03NKZ) · 🔀 [Obvious PR Artifact](https://app.obvious.ai/prs?prRef=what-is-the-thing-that-we-can-improve-in-the-whole-task:todo_3NJNA2Vt)`

**Completion note**

Stopped at user request (HALT) before starting.

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## S1: Login/registration rate limits use the trusted client IP

- **Id:** `todo_pSA3GxnG`
- **Parent:** `todo_3NJNA2Vt`
- **Status:** completed
- **Assignee:** Agent (thread `th_xPhvGHau`, chat: [chat/s1-trusted-ip-rate-limits.md](chat/s1-trusted-ip-rate-limits.md))
- **Created:** 2026-11-13 23:22:27.154 UTC
- **Completed:** 2026-11-13 23:29:15.105 UTC

**Brief**

Make the login (5 per 15 min) and registration (3 per hour) limits impossible to bypass by rotating `X-Forwarded-For` (spec §S1).
- In `apps/web/src/app/api/auth/[...all]/route.ts`, replace the inline leftmost-hop parsing with `getTrustedClientIp(request.headers)` from `@/lib/get-client-ip`. Limits, fail-open behavior and the 429 body stay unchanged. Fix any comment that describes the old behavior.
- Do NOT touch `proxy.ts` or other limiters (out of scope).

**Acceptance and tests (new `apps/web/src/__tests__/app/api/auth-route-rate-limit.test.ts` or the nearest existing convention):**
1. `x-forwarded-for: 1.1.1.1, 9.9.9.9` keys on `9.9.9.9`. With `x-real-ip: 8.8.8.8` present, the key is `8.8.8.8` (mocked `checkRateLimit`).
2. Six sign-in POSTs with different leftmost hops and the same edge hop share one bucket, and the sixth returns 429 (in-memory limiter fake).
3. `rg 'x-forwarded-for' apps/web/src/app/api/auth` is empty.
4. CI green.

**Delivery:** independent PR, **base `main`**, branch from `origin/main`. Merge yourself once CI is green.
**Planned commits:**
- `fix(auth): key login and registration rate limits on trusted client IP`
- `test(auth): cover trusted-IP rate limit keying`
Backend only: no visual evidence; state that in the PR.

**Spec:** Blueprint `art_DZ3EOoSd` ("Trustworthy answers + two security fixes"). The spec is approved and binding; follow its locked decisions.
**Guardrails:** no new npm dependencies and no CI/workflow or lint/tsconfig changes (AGENTS.md §15). Don't touch anything owned by the Teachanything Issue Triage track: file pipeline/OCR/vision, ratings, dashboard i18n, registration emails, turn lock (#465), account deletion, Common Questions, drift check, Jest ESM migration, quiz-JSON recovery. Jest is ESM: mock with `jest.unstable_mockModule` + dynamic `await import()`.
**PR body footer:** `🔗 [Obvious Project](https://app.obvious.ai/p/teach-anything-platform-research-ACxVZXNN) · 🧵 [Obvious Thread](https://app.obvious.ai/p/teach-anything-platform-research-ACxVZXNN?thread=th_nLy03NKZ) · 🔀 [Obvious PR Artifact](https://app.obvious.ai/prs?prRef=what-is-the-thing-that-we-can-improve-in-the-whole-task:todo_3NJNA2Vt)`

**Completion note**

No action needed: PR #576 is already merged into main (squash 5f03da4, 2026-11-13 23:28 UTC). S1 is complete. Login and registration limiters key on the trusted client IP, covered by six route tests, with required CI green.

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## S2: App-wide security headers, embed-aware

- **Id:** `todo_ajZ69NUG`
- **Parent:** `todo_3NJNA2Vt`
- **Status:** completed
- **Assignee:** Agent (thread `th_Ka5PL9uH`, chat: [chat/s2-security-headers.md](chat/s2-security-headers.md))
- **Created:** 2026-11-13 23:22:27.387 UTC
- **Completed:** 2026-11-13 23:42:06.148 UTC

**Brief**

Stop other sites framing dashboard, admin and auth pages while keeping `/embed/*` and `/chat/*` embeddable (spec §S2).
- Add `headers()` to `apps/web/next.config.js`:
  - All routes: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=86400` (no includeSubDomains, no preload).
  - Every route except `/embed/:path*` and `/chat/:path*`: `Content-Security-Policy: frame-ancestors 'none'` + `X-Frame-Options: DENY` (negative-lookahead source).
  - The `admin.` subdomain rewrite must get the deny headers. The download route keeps its own headers.
- No script CSP.
- `next.config.js` is app config, not lint/ts/tool config. If a reviewer reads AGENTS.md §15 otherwise, ask before merging.

**Acceptance and tests:**
1. Unit test on the exported config's `headers()` with a source-pattern matcher: `/embed/abc/window` and `/chat/abc` have no frame-deny headers; `/admin`, `/dashboard`, `/login` and `/` have both; every route has nosniff, referrer and HSTS.
2. Production-mode check: `next build && next start` plus a curl matrix over those routes, pasted into the PR.
3. agent-browser: a local HTML page on another port frames `/embed/<token>/window` successfully (screenshot) and fails to frame `/dashboard` (screenshot + console frame-ancestors error). Submit via `obvious autobuild upload` against the tested head SHA.
4. CI green.

**Delivery:** independent PR, **base `main`**, branch from `origin/main`. Merge yourself once CI is green and evidence is recorded.
**Planned commits:**
- `feat(security): add app-wide security headers with embed-aware framing`
- `test(security): cover header route matrix`

**Spec:** Blueprint `art_DZ3EOoSd` ("Trustworthy answers + two security fixes"). The spec is approved and binding; follow its locked decisions.
**Guardrails:** no new npm dependencies and no CI/workflow or lint/tsconfig changes (AGENTS.md §15). Don't touch anything owned by the Teachanything Issue Triage track: file pipeline/OCR/vision, ratings, dashboard i18n, registration emails, turn lock (#465), account deletion, Common Questions, drift check, Jest ESM migration, quiz-JSON recovery. Jest is ESM: mock with `jest.unstable_mockModule` + dynamic `await import()`.
**PR body footer:** `🔗 [Obvious Project](https://app.obvious.ai/p/teach-anything-platform-research-ACxVZXNN) · 🧵 [Obvious Thread](https://app.obvious.ai/p/teach-anything-platform-research-ACxVZXNN?thread=th_nLy03NKZ) · 🔀 [Obvious PR Artifact](https://app.obvious.ai/prs?prRef=what-is-the-thing-that-we-can-improve-in-the-whole-task:todo_3NJNA2Vt)`

**Completion note**

S2 merged: PR #579 (https://github.com/akhileshrangani4/teachanything/pull/579) squashed into main as a079d17 from tested head 5c4e352. PR artifact: art_i7P5lMLg. next.config.js now sends nosniff, strict-origin-when-cross-origin and HSTS max-age=86400 on every route. Every route except /embed and /chat (with subpaths) also gets frame-ancestors 'none' and X-Frame-Options: DENY. A host-conditioned rule denies framing across the admin. subdomain, and the download route keeps its own handler headers. No script CSP was added. Acceptance: (1) a 37-case route-matrix unit test passes and fails against the old config; (2) the production-mode next build + next start curl matrix is in the PR body; (3) cross-origin agent-browser evidence was uploaded at the head SHA: tc-1 shows the embed window framed from port 8080, tc-2 shows /dashboard blocked, and Chrome logged the frame-ancestors violation, quoted in the PR; (4) required CI passed and Codecov reports all changed lines covered. Bot comments were replied to; there were no human reviews and no reviewer raised AGENTS.md section 15. Not verified: the authenticated download response (local seeded sign-in failed) and the production edge, because the Vercel preview is behind SSO protection. The repo's npm run build fails locally in the apps/docs Astro pre-step (unrelated), so next build was run directly.

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## Save 2 secrets ("OPENAI_API_KEY", "OPENROUTER_API_KEY")

- **Id:** `todo_ZHiBnPwt`
- **Parent:** `todo_3NJNA2Vt`
- **Status:** completed
- **Assignee:** Akhilesh Rangani (`usr_DDIXh3Sc`)
- **Created:** 2026-11-13 23:23:30.985 UTC
- **Completed:** 2026-11-13 23:27:43.533 UTC

**Brief**

*(no brief)*

**Completion note**

*(none)*

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## Moving Teach Anything research off Obvious

- **Id:** `todo_3luzVCuc`
- **Parent:** `todo_3NJNA2Vt`
- **Status:** completed
- **Assignee:** Akhilesh Rangani (`usr_DDIXh3Sc`)
- **Created:** 2026-11-17 21:37:40.488 UTC
- **Completed:** 2026-11-17 21:49:07.094 UTC

**Brief**

*(no brief)*

**Completion note**

*(none)*

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## Moving Teach Anything research off Obvious

- **Id:** `todo_1sWSj1Rj`
- **Parent:** `todo_3luzVCuc`
- **Status:** completed
- **Assignee:** Akhilesh Rangani (`usr_DDIXh3Sc`)
- **Created:** 2026-11-17 21:37:40.488 UTC
- **Completed:** 2026-11-17 21:49:07.049 UTC

**Brief**

*(no brief)*

**Completion note**

*(none)*

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## Moving Teach Anything research off Obvious

- **Id:** `todo_TaaDxXuH`
- **Parent:** `todo_3luzVCuc`
- **Status:** completed
- **Assignee:** Akhilesh Rangani (`usr_DDIXh3Sc`)
- **Created:** 2026-11-17 21:37:40.488 UTC
- **Completed:** 2026-11-17 21:49:07.038 UTC

**Brief**

*(no brief)*

**Completion note**

*(none)*

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## Moving Teach Anything research off Obvious

- **Id:** `todo_gZJM8uNS`
- **Parent:** `todo_3luzVCuc`
- **Status:** completed
- **Assignee:** Akhilesh Rangani (`usr_DDIXh3Sc`)
- **Created:** 2026-11-17 21:37:40.488 UTC
- **Completed:** 2026-11-17 21:49:07.082 UTC

**Brief**

*(no brief)*

**Completion note**

*(none)*

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## Moving Teach Anything research off Obvious

- **Id:** `todo_lPK3F2ry`
- **Parent:** `todo_3luzVCuc`
- **Status:** completed
- **Assignee:** Akhilesh Rangani (`usr_DDIXh3Sc`)
- **Created:** 2026-11-17 21:37:40.488 UTC
- **Completed:** 2026-11-17 21:49:07.059 UTC

**Brief**

*(no brief)*

**Completion note**

*(none)*

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*

## Moving Teach Anything research off Obvious

- **Id:** `todo_pfqrXei1`
- **Parent:** `todo_3luzVCuc`
- **Status:** completed
- **Assignee:** Akhilesh Rangani (`usr_DDIXh3Sc`)
- **Created:** 2026-11-17 21:37:40.488 UTC
- **Completed:** 2026-11-17 21:49:07.070 UTC

**Brief**

*(no brief)*

**Completion note**

*(none)*

**Comments**

*Not retrievable: `comments.list` returned `NOT_FOUND`.*
