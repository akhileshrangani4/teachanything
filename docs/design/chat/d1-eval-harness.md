# Chat: D1: Retrieval & answer evaluation harness

- **Source thread:** `th_8BBfSr68`
- **Task:** `todo_SE7TN5XZ` ("D1: Retrieval & answer evaluation harness")
- **Exported:** 2026-11-17 (messages up to 2026-11-14 00:20:28.163 UTC)
- **Messages:** 5 user and assistant text messages, out of 581 thread entries; tool calls, tool results and reasoning are omitted.

Each message is reproduced verbatim inside a text fence, oldest first. `user` is the role the platform recorded: it covers Akhilesh Rangani's own messages and platform-delivered ones (task briefs, run-engine steps, GitHub signals, sub-thread results, reminders). `assistant` is the Obvious agent.

## 1. user — 2026-11-13 23:23:17.741 UTC

```text
## Assigned computer
Use `computerId: "cmp_m3rUfWXx"` for source, edits, builds, tests, and git. Keep file-consuming commands on the computer holding those files. Platform-only operations can use obvious-sdk.

[AUTOBUILD] Pre-assigned branch: feat/eval-harness
You MUST use this branch for your work.
[AUTOBUILD] Assigned subtask: todo_SE7TN5XZ
[AUTOBUILD] Acceptance criteria (mustHaves):
- The codebase areas touched by the brief are identified and understood well enough to write a grounded spec.
- CI is green on every PR and the acceptance criteria are met. Applicable visual PRs have evidence recorded against their tested head SHA before merge, or backend-only work has a concrete visual-evidence exception.

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
```

## 2. user — 2026-11-13 23:28:13.566 UTC

```text
Both project secrets are now configured: OPENAI_API_KEY and OPENROUTER_API_KEY. Inject them per call with secretsToInject ["SECRET_OPENAI_API_KEY"] / ["SECRET_OPENROUTER_API_KEY"] and map them to the env names the app reads. Never echo, log or commit them. The embedding cache and baseline are unblocked: generate real embeddings, don't stub them. Run eval:answers with the OpenRouter key as well, so the baseline includes answer-mode citation validity and denial rate.
```

## 3. user — 2026-11-14 00:02:28.758 UTC

```text
<system-reminder>
Your task: "D1: Retrieval & answer evaluation harness"

You completed without reporting your status. Please:
1. Use the SDK report command: obvious tasks report --status=success|failed|needs_input --message="<message>" — to report terminal status
2. Or continue working on the task if not yet complete

IMPORTANT: You must report via obvious tasks report before your execution ends.
</system-reminder>
```

## 4. user — 2026-11-14 00:11:03.486 UTC

```text
Orchestrator check on the preliminary baseline (from dirty commit cd71bba): page accuracy reads 0 while recall@injected is 1.0. Before you commit eval/baseline.json, find out why. Either the anchor/page matching in the harness is wrong (e.g. pageNumber missing from fixture chunk metadata, 0- vs 1-based pages, or comparing against the wrong field), or the production pipeline really doesn't carry page numbers for these PDFs. If it's a harness bug, fix it and add a unit test. If it's real production behaviour, keep the 0, explain it in the PR body as a finding, and point out what it means for D3/D4 page citations. Also report the off-topic false-injection rate (1.0) and median injected tokens (~14k) in the PR body as the headline baseline findings. Note that recall@injected=1.0 is inflated because the small corpus fits in the context window.
```

## 5. assistant — 2026-11-14 00:20:28.163 UTC

```text
Commit 4 is the retrieval runner plus only the `eval:retrieval` script. I'm staging a `package.json` without the answers line for this commit.
```
