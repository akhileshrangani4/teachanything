# Chat: what is the thing that we can improve in the whole platform? dont tooch what Te…

- **Source thread:** `th_nLy03NKZ`
- **Task:** root `todo_3NJNA2Vt` ("what is the thing that we can improve in the whole platform? dont tooch what Te…") — the Autobuild orchestration thread
- **Exported:** 2026-11-17 (messages up to 2026-11-17 21:49:57.597 UTC)
- **Messages:** 51 user and assistant text messages, out of 221 thread entries; tool calls, tool results and reasoning are omitted.

Each message is reproduced verbatim inside a text fence, oldest first. `user` is the role the platform recorded: it covers Akhilesh Rangani's own messages and platform-delivered ones (task briefs, run-engine steps, GitHub signals, sub-thread results, reminders). `assistant` is the Obvious agent.

## 1. user — 2026-11-13 22:59:51.241 UTC

```text
what is the thing that we can improve in the whole platform? dont tooch what Teachanything Issue Triage is working on. this is a new ventured track that we can maybe land, some new fetures or improvements
```

## 2. user — 2026-11-13 22:59:52.367 UTC

```text
[Run engine] what is the thing that we can improve in the whole platform? dont tooch what Te… (root todo_3NJNA2Vt) activated step "Research" (research). Work it now.

Read-only exploration of the repository when it is unfamiliar: map the relevant modules, conventions, and existing patterns. No code changes in this stage.

Done when: The codebase areas touched by the brief are identified and understood well enough to write a grounded spec.

This stage is designated for coder workers. Dispatch them yourself, in parallel when the work splits, each with a prompt you write from the spec and plan.

When done, complete step task todo_buuV6yqT: `obvious tasks update --taskId=todo_buuV6yqT --status=completed --completionNote="<what you produced>"`. Do not mark the step passed; its gate decides that. Do not complete the run's root task (todo_3NJNA2Vt); the run settles it.
```

## 3. assistant — 2026-11-13 23:01:21.938 UTC

```text
I'm treating "the platform" as Teach Anything, since that's the repo the Issue Triage track works in. I've started three read-only research tracks on it, all running at once:

1. **Product and feature gaps:** the professor dashboard, the student chat and the admin console. This covers flows that dead-end or look half-built, plus feature requests in the backlog that no one has claimed.
2. **AI tutoring core:** how the app finds and uses course material to answer (chunking, retrieval, reranking), citations, prompts, model fallbacks, cost limits and teaching modes.
3. **Platform health:** whether every API endpoint checks the user is allowed to see the data, rate limiting, logging and error tracking, slow database queries, CI and developer tooling. The Triage workers flagged three problems they didn't fix, and this track will look at them:
   - The database-backed tests are skipped in CI because CI has no Postgres.
   - The seed script writes login records in a format the current Better Auth version rejects, so the demo logins don't work.
   - The admin `deleteUser` error handling has no tests.

Each track has the full off-limits list from Issue Triage, so none of them will propose work it already owns. That list covers:
- the file pipeline (OCR, RTF uploads, vision, the background-job and retry items)
- response ratings
- dashboard translations
- registration emails
- the one-chat-turn-at-a-time lock
- account deletion
- removing the anonymous account-status endpoint
- Common Questions grouping
- the schema-drift check
- the Jest mocking fix
- the quiz-JSON leak fix

Each track will publish one findings doc in this project. It ranks five candidates with code references, user value, rough size, risks and a check against that list. It also lists ideas it rejected and why. No code changes or PRs come out of this stage.

When all three are back, I'll pull them into a shortlist and ask you which direction to take before I write the spec.
```

## 4. assistant — 2026-11-13 23:01:26.422 UTC

```text
I’m treating “the platform” as Teach Anything, the repo used by the Issue Triage track. I’ve started three read-only research tracks:

1. **Product and feature gaps** across the professor dashboard, student chat, and admin console—including dead-end or incomplete flows and unclaimed backlog requests.
2. **AI tutoring**: course-material chunking and retrieval, reranking, citations, prompts, model fallbacks, cost limits, and teaching modes.
3. **Platform health**: API authorization, rate limiting, logging and error tracking, slow database queries, CI, and developer tooling. This track will also investigate three issues Triage flagged but didn’t fix:
   - Database-backed tests are skipped in CI because CI has no Postgres.
   - The seed script writes login records in a format the current Better Auth version rejects, so demo logins don’t work.
   - There are no tests for the admin `deleteUser` error handling.

All three tracks received Issue Triage’s off-limits list, covering the file pipeline, response ratings, dashboard translations, registration emails, the one-chat-turn-at-a-time lock, account deletion, anonymous account-status endpoint removal, Common Questions grouping, schema-drift checks, the Jest mocking fix, and the quiz-JSON leak fix.

Each track is intended to produce one findings doc in this project, ranking five candidates with code references, user value, rough size, risks, and an off-limits check, plus rejected ideas and reasons. **The research is underway; the findings docs and shortlist aren’t ready yet.** No code changes or PRs are part of this stage.
```

## 5. user — 2026-11-13 23:08:11.335 UTC

```text
<subthread-result thread-id="th_JF7nohUZ" task="Research: platform reliability, performance, security & developer experience" status="success">
Published the platform health findings document (art_ktM9QU8j). The repo was not changed: no edits, branch, PR or GitHub comments. Top 5, ranked: (1) S: rate limiting. Login and registration are keyed on the leftmost X-Forwarded-For, which the repo's own helper documents as spoofable (auth/[...all]/route.ts:18-20 vs lib/get-client-ip.ts). The proxy also applies an IP-only public-chat limit to page loads and the chat API, which undercuts the per-classroom design. adminActionRateLimit is never called. (2) S: the demo seed writes account_id = email, but Better Auth 1.7.5 sign-in requires accountId === user.id (sign-in.mjs:316), so the logins documented in SETUP.md fail. (3) M: the two TEST_DATABASE_URL suites skip in CI because test.yml has no Postgres. No router-level ownership or IDOR regression tests exist, and admin deleteUser is untested. (4) M: observability. logWarn is gated by ENABLE_LOGGING, which is off in .env.example. tRPC logs expected 4xx errors as [ERROR]. Client error boundaries only log to the browser console, and there is no Sentry or OpenTelemetry. (5) S: no app-wide security headers (next.config.js has no headers()), so admin pages can be framed; a fix must keep /embed/* frameable. No IDOR found in the sampled procedures. Runner-up: missing user_id indexes on chatbots, account and session. None of the 5 findings has a backing open issue (11 issues open); overlaps with #399 and #315 for finding 3 are noted. Workflow and dependency changes need explicit maintainer sign-off under AGENTS.md section 15. Impacts are inferred, not measured. Open questions include how the production edge handles X-Forwarded-For and whether ENABLE_LOGGING is set in production.
<created-artifacts>art_ktM9QU8j</created-artifacts>
<batch-complete>true</batch-complete>
Every task in this batch has settled. The other members reported:
<batch-result task-id="todo_Kew0OkLt" thread-id="th_eIDtGcR6" task="Research: product & feature gaps (professor, student, admin surfaces)" status="needs_action">
Published findings doc art_GFoVZKhr ('Product and feature gaps: ranked findings'). Read-only research on main@7fee02e; no branch, edits, PR or GitHub comments (the pre-assigned branch was intentionally unused per the read-only brief). Ranked top 5 (all observed in code, none backed by an open issue since all 11 open issues are on the off-limits list): 1) Embed appearance settings (M) - chatbots.embedSettings column exists but nothing reads/writes it, snippet hard-codes position/colours, yet docs (customize.mdx, share-and-embed.mdx, embed tutorial) promise theme/corner/colours; also iframes lack title. 2) Suggested starter questions (S) - suggestedQuestions stored, validated and returned by public getByShareToken but no UI sets or renders it. 3) Duplicate chatbot (S-M) - card menu has only Open/Delete; copy = new row + association rows. 4) Quiz performance analytics (M) - study_tool_responses stores score/total/answers, schema comment says built for analytics, no aggregate card; sequence after #564. 5) Student chat resume after reload (M) - useChat.ts comment 'no cross-reload history rehydration in this phase'; sequence after #572. Rejected with reasons: student export and professor conversation review (already shipped), templates (i18n collision), LTI (needs student identity, L), course grouping, scheduled availability, onboarding, broad a11y pass, phase-2 study tools (tutoring track), admin additions (unused admin.getAllConversations goes to platform health), embed postMessage origin hardening (platform health). Open questions: student identity roadmap, live vs re-copy embed settings, localStorage vs sessionStorage, locale-key coordination, and whether the React embed snippet's inline script runs at all (inferred, unverified).
<created-artifacts>art_GFoVZKhr</created-artifacts>
</batch-result>
<batch-result task-id="todo_Mhuo5Kdu" thread-id="th_9a6BvAqr" task="Research: AI tutoring core — RAG retrieval, prompts, models, pedagogy" status="needs_action">
Published the AI tutoring-core findings document (art_0xSIXg3p). It is read-only research: no code, branch, PR or GitHub comments, so no CI ran and screenshots don't apply. Ranked top 5: (1) retrieval and answer-quality eval harness, since none exists and tuning relies on production samples quoted in code comments; (2) retrieval precision: the injected context is sized by the context window rather than relevance, with an estimated ~98 chunks (~20-25k tokens) per request on Llama 3.3 70B (worked out from code constants, not measured), and there is no reranker, no relevance floor, a stale AVG_CHUNK_TOKENS value and a latest-message-only query; (3) answer-level citations: sources show everything retrieved, not what was used, the done tool and the grounding rule give contradictory citation instructions, injected passages carry no page number, and showSources defaults to off; (4) per-chatbot tutoring modes (Direct, Guided/Socratic, Hints-only) to stop answers being handed over on graded work, since none exists and the default prompt is one sentence; (5) token usage metering and per-chatbot budgets, since no usage is recorded anywhere and rate limits are the only spend control. No open issue backs any candidate; all open issues are on the off-limits list. Candidate 5 brushes the on-hold #131 if it grows into dashboards, and this is flagged in the document. The document also covers the end-to-end map, 10 considered-and-rejected items and 6 open questions.
<created-artifacts>art_0xSIXg3p, art_GFoVZKhr</created-artifacts>
</batch-result>
</subthread-result>
```

## 6. user — 2026-11-13 23:09:03.572 UTC

```text
[Run engine] what is the thing that we can improve in the whole platform? dont tooch what Te… (root todo_3NJNA2Vt) activated step "Spec" (spec). Work it now.

Write the Blueprint spec with verifiable acceptance criteria. Every deliverable gets acceptance criteria, including tests where code is produced. Record the delivery in the locked decisions: one PR, independent PRs, or a release branch. Two or more related PRs take a release branch, and so does any set that must land together. If research surfaced ambiguity or material trade-offs, ask the user an informed question — with your recommendation — before writing the spec; when the picture is clear, proceed. Once the spec is saved, complete this stage with a one-line summary of the blueprint as the completion note: the user approves the spec at this stage before planning starts. If they comment asking for changes, revise the same blueprint and complete the stage again.

Done when: The spec is saved, every deliverable in it has verifiable acceptance criteria including tests, and the user approved it.

When done, complete step task todo_jpxLDnaB: `obvious tasks update --taskId=todo_jpxLDnaB --status=completed --completionNote="<what you produced>"`. Do not mark the step passed; its gate decides that. Do not complete the run's root task (todo_3NJNA2Vt); the run settles it.
```

## 7. assistant — 2026-11-13 23:09:13.850 UTC

```text
The research is done, but I haven't written the spec yet. First I need you to pick which direction it should cover.

Three read-only research passes turned up 15 improvement ideas, each tied to the code it comes from. None of them overlaps what Issue Triage is working on. They fall into four tracks:

- **Trustworthy answers (my recommendation):** answer quality is the product's core value, and right now nothing checks it.
  - Each chat turn pulls in roughly 98 passages (about 20–25k tokens), sized to fill the model's context window rather than by relevance. I estimated that from the code's settings; it isn't measured.
  - Nothing re-ranks those passages and there's no relevance cut-off.
  - With default settings, students see no sources at all.
  - The prompts give the model contradictory instructions about citing.

  The track is a test suite for answer quality first, then tighter retrieval, then citations that link to the page the answer used. Building the tests first means the retrieval changes can't quietly bring back #271 (confident "not in your materials" answers when the answer is there). The cost is about 5 PRs merged together, so it ships later than the alternatives.
- **Teaching modes:** each chatbot gets a setting for direct answers, guided questioning, or hints only, plus quiz results in analytics.
- **Professor quick wins:**
  - the embed appearance settings the docs already promise but the app doesn't have
  - suggested starter questions
  - duplicating a chatbot
  - letting students resume a chat after a page reload
- **Platform hardening:**
  - Login and registration rate limits trust a client-supplied IP header, so they're easy to get around.
  - The demo logins don't work because the seed script writes them in a format the current login library rejects.
  - The app sends no security headers, so admin pages can be embedded in other sites.
  - Database tests are skipped in CI.
  - Production logging and error tracking are weak.

I've also asked whether to add the two small security fixes (the rate-limit IP header and the missing security headers) whichever track you choose; my default is yes. Once you answer, I'll write the spec for your approval.

The three findings docs are in the project: product gaps, AI tutoring, and platform health.
```

## 8. user — 2026-11-13 23:10:56.892 UTC

```text
Question Responses:

Which track(s) should the spec cover?
- Trustworthy answers: eval harness → retrieval precision (reranked top-k, relevance floor, follow-up query rewrite) → answer-level citations with page links (art_0xSIXg3p #1–3)

Whatever track you pick, should I also include the two small security fixes: login/registration rate limits keyed on a spoofable X-Forwarded-For header, and no security headers (admin pages can be framed; /embed stays frameable)? Each is about one PR.
Yes
```

## 9. assistant — 2026-11-13 23:16:53.999 UTC

```text
The spec is written and waiting for your approval. Building starts only after you approve it.

**What I found in the code:**
- **Context is sized by the model's window, not by relevance.** On the default model, the code's constants work out to roughly 98 chunks per turn. That's my arithmetic from the code, not a measurement. Retrieval has no similarity cutoff.
- **The prompts contradict each other on citations.** The grounding rule says "do NOT put inline citations", while the search tool's instructions say "cite the file and page."
- **The sources shown aren't the ones the answer used.** The sources list is everything retrieved, and it's hidden by default.
- **Students can't open the files.** Only the owner can download them, so page links can't be offered to students.
- **Login and registration rate limits use the spoofable IP.** They read the first IP in the forwarded-IP header, which the caller controls. The repo already has a helper that reads the trusted one.
- **No security headers are set anywhere.**

**What I'm proposing:**
- **D1 – measurement first.** An offline harness that tests retrieval against 50+ hand-written questions. It caches embeddings, so the same commit always gives the same numbers. Its first run on today's code becomes the baseline that D2 and D3 are judged against.
- **D2 – tighter retrieval.**
  - A fixed cap on the number of passages, plus a minimum-relevance cutoff that still keeps exact-phrase matches. That protects against #271, where the bot wrongly says something isn't in the materials.
  - Follow-up questions get rewritten into standalone searches.
  - Reranking with an AI model is built but off by default. It only gets turned on if the measurements show at least a 3-point gain at a cost of no more than 800 ms.
  - Targets: at least 0.85 recall, at least 60% fewer injected tokens, and most off-topic questions get no context.
- **D3 and D4 – citations.** The model marks claims with `[n]` and the server matches those to the passages actually used. Students see numbered footnotes with file, page and an excerpt of up to 280 characters, only when the professor has sources turned on. Page links work only for the professor. If a model ignores the format, chat falls back to today's sources list.
- **S1:** login and registration limits switch to the existing trusted-IP helper.
- **S2:** pages other than chat and embed can't be framed by other sites. The `/embed/*` and `/chat/*` pages can still be embedded, so LMS embeds keep working.
- **Delivery:** D1–D4 go on one release branch, `release/trustworthy-answers`. S1 and S2 are separate small PRs to `main`. No new dependencies and no CI changes.

**One change from what I first offered:** I'd pitched citations "with page links". Page links are now professor-only, and students get excerpts instead. Adding file access for students would be a new privacy and copyright exposure.

**Three open questions in the spec:**
- **OpenRouter key.** Without one, only the retrieval measurements are checked, and the citation checks and the #271 regression check don't run.
- **Sources default.** I'm leaving sources off by default, so students only see citations where professors turn them on.
- **Production IP header.** Whether production actually sets the trusted IP header. This changes how much S1 helps, not the code.

If you approve, I'll break this into tasks and start the coders. If you leave comments, I'll revise the same spec.
```

## 10. assistant — 2026-11-13 23:16:59.990 UTC

```text
The spec is written and waiting for your approval. Building starts only after you approve it.

**What I found in the code:**
- **Context is sized by the model’s window, not relevance.** On the default model, the code’s constants work out to roughly 98 chunks per turn. That’s arithmetic from the code, not a measurement. Retrieval has no similarity cutoff.
- **The prompts contradict each other on citations.** The grounding rule says “do NOT put inline citations,” while the search tool’s instructions say “cite the file and page.”
- **The displayed sources aren’t necessarily the ones the answer used.** The sources list is everything retrieved, and it’s hidden by default.
- **Students can’t open the files.** Only the owner can download them, so page links can’t be offered to students.
- **Login and registration rate limits use the spoofable IP.** They read the first IP in the forwarded-IP header, which the caller controls. The repo already has a helper that reads the trusted one.
- **No security headers are set anywhere.**

**What the spec proposes:**
- **D1 – Measurement first:** An offline harness testing retrieval against 50+ hand-written questions. It caches embeddings, so the same commit produces the same numbers. The first run on today’s code becomes the baseline for D2 and D3.
- **D2 – Tighter retrieval:**
  - Cap the number of passages and set a minimum-relevance cutoff that still retains exact-phrase matches. This is intended to guard against #271, where the bot wrongly says something isn’t in the materials.
  - Rewrite follow-up questions into standalone searches.
  - Build AI-model reranking behind an off-by-default flag. Enable it only if measurements show at least a 3-point gain at a cost of no more than 800 ms.
  - Targets: at least 0.85 recall, at least 60% fewer injected tokens, and most off-topic questions get no context.
- **D3 and D4 – Citations:** The model marks claims with `[n]`; the server matches those markers to passages actually used. Students see numbered footnotes with the file, page, and an excerpt of up to 280 characters, only when the professor has sources turned on. Page links work only for the professor. If the model ignores the format, chat falls back to today’s sources list.
- **S1:** Switch login and registration limits to the existing trusted-IP helper.
- **S2:** Prevent other sites from framing pages except `/embed/*` and `/chat/*`, which remain embeddable for LMS use.
- **Delivery:** D1–D4 go on one release branch, `release/trustworthy-answers`. S1 and S2 are separate small PRs to `main`. No new dependencies or CI changes.

One change from the initial proposal: page links are professor-only; students get excerpts instead. Giving students file access would create a new privacy and copyright exposure.

**Open questions in the spec:**
- **OpenRouter key:** Without one, only retrieval measurements are checked; citation checks and the #271 regression check don’t run.
- **Sources default:** Sources remain off by default, so students see citations only when professors turn them on.
- **Production IP header:** Whether production sets the trusted IP header. This changes how much S1 helps, not the code.

Approve the spec to let me break it into tasks and start the coders, or leave comments and I’ll revise the same spec.
```

## 11. user — 2026-11-13 23:19:32.653 UTC

```text
[Run engine] what is the thing that we can improve in the whole platform? dont tooch what Te… (root todo_3NJNA2Vt) activated step "Plan" (plan). Work it now.

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

Done when: A complete task DAG covering every spec deliverable exists as subtasks of the build, with per-subtask complexity set and every code subtask naming its verifying tests.

When done, complete step task todo_GEiLkVdl: `obvious tasks update --taskId=todo_GEiLkVdl --status=completed --completionNote="<what you produced>"`. Do not complete the run's root task (todo_3NJNA2Vt); the run settles it.
```

## 12. assistant — 2026-11-13 23:23:45.170 UTC

```text
The build has started. Four coders are working now and three more are queued behind them. One thing I need from you: the evaluation harness's baseline can't be built without an OpenAI API key.

**Running now**
- **D1, answer-quality test harness:** a set of course documents and at least 50 test questions, plus a saved baseline of how well today's search finds the right passages.
- **D4a, citation display pieces:** the clickable citation marker and the footnote list.
- **S1, login/registration rate limits:** fixes the bypass where someone can dodge the limits by faking the forwarded IP header. Opens its own PR to `main`.
- **S2, security headers:** stops other sites from embedding dashboard, admin and login pages, while LMS embeds keep working. Also its own PR to `main`.

**Queued, each starts when the one before it finishes**
- D2 (retrieval changes) waits for D1's baseline.
- D3 (server-side citations) waits for D2, because both edit the same retrieval files.
- D4b (citations shown in chat) waits for D3 and D4a.

**Release setup**
- D1–D4 merge into `release/trustworthy-answers`. Draft PR [#575](https://github.com/akhileshrangani4/teachanything/pull/575) will move them all to `main` in one merge.
- The repo's test and build CI only runs on PRs to `main`. So each D-series PR records local lint, type-check, test and build results in its description, and full CI runs once, on #575. I added this to the spec rather than editing the CI workflows, which the spec rules out.

**The keys**
- I've sent you a card to save `OPENAI_API_KEY` and `OPENROUTER_API_KEY`.
- **OpenAI key:** the harness needs it once to compute embeddings for the test documents. After that the harness runs without any key. If it's missing, D1 will push everything else and stop at that step rather than fake the data, which also holds up D2–D4b.
- **OpenRouter key (optional):** lets me measure live answer quality and test citations with real answers. Without it, those checks are marked "not run" in the PRs and the citation UI is tested on pre-filled conversations.
```

## 13. assistant — 2026-11-13 23:23:50.018 UTC

```text
The build is underway: four tasks are running and three are queued behind dependencies.

**Running**
- **D1:** Answer-quality test harness with course documents, at least 50 test questions, and a baseline of current search results.
- **D4a:** Clickable citation markers and footnote list.
- **S1:** Fixes login/registration rate-limit bypass via spoofed forwarded-IP headers. Opens its own PR to `main`.
- **S2:** Prevents other sites from embedding dashboard, admin, and login pages while preserving LMS embeds. Opens its own PR to `main`.

**Queued**
- **D2:** Retrieval changes; waits for D1’s baseline.
- **D3:** Server-side citations; waits for D2 because they edit the same retrieval files.
- **D4b:** Citations in chat; waits for D3 and D4a.

**Release**
- D1–D4 target `release/trustworthy-answers`; draft release PR [#575](https://github.com/akhileshrangani4/teachanything/pull/575) will bring them to `main` in one merge.
- CI only runs for PRs to `main`. Each D-series PR will record local lint, type-check, test, and build results; full CI will run on #575. The workflows were not changed.

**API keys needed**
I’ve sent a confirmation card to save `OPENAI_API_KEY` and `OPENROUTER_API_KEY` (proposal `prop_RCCMcrgG`).

- **OpenAI key required:** D1 needs it once to embed the test documents. Without it, D1 will stop before producing the baseline, holding up D2–D4b; it won’t fake the data.
- **OpenRouter key optional:** Enables live answer-quality measurements and citation tests with real answers. Without it, those checks will be marked “not run,” and the citation UI will be tested with pre-filled conversations.
```

## 14. user — 2026-11-13 23:23:52.304 UTC

```text
[Run engine] what is the thing that we can improve in the whole platform? dont tooch what Te… (root todo_3NJNA2Vt) activated step "Implement" (implement). Work it now.

Execute the plan: one PR per subtask, conventional commits, lint and tests green before reporting done. Each coder owns its PR end-to-end. For a PR that changes rendered UI, visual state, or an interactive workflow, dogfood the change with agent-browser before merge. Capture a screenshot for a static visual result, and before/after screenshots plus a short WebM recording for an interaction. Submit each acceptance criterion through `obvious autobuild upload` against the tested head SHA — load the autobuild-qa skill first; it owns capture and submission rules — so Obvious records canonical evidence and can attach supported media to the PR. For backend-only work, state the concrete reason visual evidence is not applicable. Once the applicable evidence is recorded, merge or report ready for approval according to workspace policy. Trust it on process state (CI, checks, mergeability), redirect it via `obvious tasks steer` if it reports a blocker. Deliverable acceptance stays yours: verify results against the spec acceptance criteria before advancing a task.

Done when: CI is green on every PR and the acceptance criteria are met. Applicable visual PRs have evidence recorded against their tested head SHA before merge, or backend-only work has a concrete visual-evidence exception.

This stage is designated for coder workers. Dispatch them yourself, in parallel when the work splits, each with a prompt you write from the spec and plan.

When done, complete step task todo_tN0e9poI: `obvious tasks update --taskId=todo_tN0e9poI --status=completed --completionNote="<what you produced>"`. Do not mark the step passed; its gate decides that. Do not complete the run's root task (todo_3NJNA2Vt); the run settles it.
```

## 15. assistant — 2026-11-13 23:24:02.062 UTC

```text
Nothing has changed yet. Four tasks are running now: the eval harness (D1), the citation components (D4a), and the two security fixes (S1, S2). D2, D3 and D4b are queued behind them. I'm still waiting on your answer to the API-key card. The OpenAI key is the one D1 needs before it can save its baseline.
```

## 16. user — 2026-11-13 23:24:17.727 UTC

```text
[Task comment from Akhilesh Rangani]
Task: "Save 2 secrets ("OPENAI_API_KEY", "OPENROUTER_API_KEY")" (todo_ZHiBnPwt)
Comment: wherer are you getting the4se from?
Answer on the task with `tasks.comments.create` (taskId `todo_ZHiBnPwt`): the person reads the task, not this thread.
Comment id: `tdc_czxv5RA8`
```

## 17. assistant — 2026-11-13 23:24:40.350 UTC

```text
I don't have these keys. They're your own provider keys, the same two Teach Anything already runs on: `apps/web/.env.example` lists `OPENROUTER_API_KEY` for the chat models and `OPENAI_API_KEY` for embeddings. You can copy them from your deployment's environment, or create new ones at platform.openai.com/api-keys and openrouter.ai/keys. You paste the values into the card, and I never see them.

- **OpenAI key:** this is the one that matters. The test harness uses it once to turn the test documents and questions (at most 300 passages and about 50 questions) into embeddings, then saves those. Later runs don't call the API.
- **OpenRouter key:** optional. It's only for live checks of answer quality and citations. Without it, those checks are marked "not run".

If you'd rather not share either, dismiss the card. The test harness then stops before recording its baseline, and the retrieval and citation work can't be measured against the spec's targets. I've put the same answer on the task.
```

## 18. assistant — 2026-11-13 23:24:44.061 UTC

```text
I don’t have these keys. They’re your own provider keys—the same ones Teach Anything already uses: `apps/web/.env.example` lists `OPENROUTER_API_KEY` for chat models and `OPENAI_API_KEY` for embeddings. You can copy them from your deployment environment or create new ones at [platform.openai.com/api-keys](https://platform.openai.com/api-keys) and [openrouter.ai/keys](https://openrouter.ai/keys). Paste the values into the task card; I won’t see them.

- **OpenAI key:** Required for the test harness to embed the test documents and questions (up to 300 passages and about 50 questions). It saves those embeddings, so later runs don’t call the API.
- **OpenRouter key:** Optional; it enables live checks of answer quality and citations. Without it, those checks are marked “not run.”

If you’d rather not provide either key, dismiss the card. The harness will stop before recording its baseline, so retrieval and citation work can’t be measured against the spec’s targets.
```

## 19. user — 2026-11-13 23:25:17.947 UTC

```text
[Task comment from Akhilesh Rangani]
Task: "Save 2 secrets ("OPENAI_API_KEY", "OPENROUTER_API_KEY")" (todo_ZHiBnPwt)
Comment: @Autobuild is it safe to paste here? wtf
Answer on the task with `tasks.comments.create` (taskId `todo_ZHiBnPwt`): the person reads the task, not this thread.
Comment id: `tdc_Ogv7Tksz`
```

## 20. assistant — 2026-11-13 23:25:41.008 UTC

```text
No, don't paste a key in a comment. Anyone on the project can read comments as plain text.

**Where keys go:** only into the value boxes on the "Save 2 secrets" card. You type them in, they're saved as project secrets, and I never see them. They're only passed to the specific commands that need them.

**Safest setup:** make new keys just for this work instead of reusing your production ones. Give them a low spending limit and revoke them once the build is done. The OpenAI one is the only key needed, and it's used once to process a few hundred short pieces of text. You can leave the OpenRouter box empty.

**If you'd rather not store any key:** dismiss the card. Everything that doesn't need a key still ships, but the starting measurement that the search and citation changes are checked against can't be taken.

I've posted the same answer on the task.
```

## 21. assistant — 2026-11-13 23:25:44.534 UTC

```text
No—don’t paste a key in a comment. Anyone on the project can read comments as plain text.

Enter keys only in the value boxes on the **“Save 2 secrets”** card. They’re stored as project secrets, and I never see the values. Use new keys for this work, not production keys; set a low spending limit and revoke them when the build is done. Only `OPENAI_API_KEY` is needed, for a one-time run over a few hundred short texts. You can leave `OPENROUTER_API_KEY` empty.

If you’d rather not store a key, dismiss the card. Work that doesn’t need a key can still ship, but we won’t be able to take the starting measurement used to check the search and citation changes.

I’ve posted this answer on the task.
```

## 22. user — 2026-11-13 23:26:12.123 UTC

```text
[Task comment from Akhilesh Rangani]
Task: "Save 2 secrets ("OPENAI_API_KEY", "OPENROUTER_API_KEY")" (todo_ZHiBnPwt)
Comment: i just dont understand where i would put the keys
Answer on the task with `tasks.comments.create` (taskId `todo_ZHiBnPwt`): the person reads the task, not this thread.
Comment id: `tdc_fMUSaZMv`
```

## 23. assistant — 2026-11-13 23:26:36.746 UTC

```text
The keys go on a card in this build's chat, not in a task comment.

1. Open this chat and scroll to my latest messages.
2. Find the card titled **"Save 2 secrets (OPENAI_API_KEY, OPENROUTER_API_KEY)"**. It has one input box for each key.
3. Paste your OpenAI key into the `OPENAI_API_KEY` box. The `OPENROUTER_API_KEY` box can stay empty.
4. Approve the card.

The keys are saved as project secrets, and I never see them. The card is still waiting for you and stays open until Nov 20. If you can't find it, or it has no input boxes, tell me and I'll send a new one. I posted the same steps on the task.

Meanwhile the evaluation harness, the citation components and the two security fixes are still in progress. The harness can't record its baseline until the OpenAI key is saved.
```

## 24. assistant — 2026-11-13 23:26:39.574 UTC

```text
The keys go on the card in this build’s chat, not in a task comment:

1. Open this chat and scroll to my latest messages.
2. Find **“Save 2 secrets (OPENAI_API_KEY, OPENROUTER_API_KEY)”**. There’s an input box for each key.
3. Paste your OpenAI key into `OPENAI_API_KEY`. You can leave `OPENROUTER_API_KEY` empty.
4. Approve the card.

The card is still pending and stays open until Nov 20. The keys will be saved as project secrets; I won’t see them. I also posted these steps on the task.
```

## 25. user — 2026-11-13 23:27:43.819 UTC

```text
SDK proposal prop_RCCMcrgG (secrets.upsert) was approved. Execution: executed. Read the full outcome via proposals.get.
```

## 26. assistant — 2026-11-13 23:28:15.069 UTC

```text
Both keys are saved. The worker building the evaluation harness (D1) can now use them for the test data and the starting measurement, which means real embeddings instead of a stand-in, plus a first check of live answers. The tasks still waiting their turn (D2, D3, D4b) will have the same keys when they start.

The login and registration rate-limit fix (S1) is open as PR #576 against `main`. Its tests pass locally, and it's waiting on CI before it merges. The citation components (D4a) and the security headers (S2) are still in progress.
```

## 27. assistant — 2026-11-13 23:28:18.301 UTC

```text
Both API keys were saved successfully: `OPENAI_API_KEY` and `OPENROUTER_API_KEY`. I notified the D1 evaluation-harness worker that the secrets are available.

S1 is open as PR #576 against `main`; its tests pass locally and it’s awaiting CI. D4a (citation components) and S2 (security headers) are still in progress.
```

## 28. user — 2026-11-13 23:30:39.084 UTC

```text
[This event was received for completed work task "S1: Login/registration rate limits use the trusted client IP" (thread: th_xPhvGHau, status: completed). The worker has finished — handle this at the orchestrator level.]

## 💬 New comments on [PR #576: fix(auth): key login and registration rate limits on trusted client IP](https://github.com/akhileshrangani4/teachanything/pull/576)
**Repository:** akhileshrangani4/teachanything

### [@codecov[bot]](https://github.com/akhileshrangani4/teachanything/pull/576#issuecomment-6867550493) · Nov 13, 11:29 PM

## [Codecov](https://app.codecov.io/gh/akhileshrangani4/teachanything/pull/576?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=Akhilesh+Rangani) Report
:white_check_mark: All modified and coverable lines are covered by tests.

:loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)
```

## 29. user — 2026-11-13 23:30:50.549 UTC

```text
GitHub event received — agent wake requested
```

## 30. assistant — 2026-11-13 23:31:05.489 UTC

```text
S1 is merged into `main` as PR #576 (`5f03da4`) and checks out against its acceptance criteria.
- All the CI checks that ran passed, including the test and build jobs.
- Codecov reports every changed line is covered by tests.
- Nothing in `main`'s auth routes reads `x-forwarded-for` directly anymore.
- Login and registration rate limits now key on the trusted client IP.

Whether that actually helps in production depends on the proxy in front of the app setting `x-real-ip`, or adding the client's IP as the last `X-Forwarded-For` hop. I can't check that from the code.

Still in progress: the evaluation harness (D1, now using the saved keys), the citation components (D4a) and the security headers (S2). D2, D3 and D4b are queued behind them.
```

## 31. assistant — 2026-11-13 23:31:07.466 UTC

```text
S1 is merged into `main` as PR #576 (`5f03da4`), and the acceptance criteria are met: all CI checks that ran passed, Codecov reports full coverage of the changed lines, the auth routes no longer read `x-forwarded-for` directly, and login and registration rate limits use the trusted client IP.

Production behavior depends on the proxy setting `x-real-ip` or appending the client IP as the last `X-Forwarded-For` hop; I can’t verify that from the code.

Still in progress: D1 (evaluation harness, using the saved keys), D4a (citation components), and S2 (security headers). D2, D3, and D4b are queued behind them.
```

## 32. user — 2026-11-14 00:09:28.738 UTC

```text
whats the statys
```

## 33. assistant — 2026-11-14 00:09:59.317 UTC

```text
Three of the seven pieces have shipped. The answer-quality test harness (D1) is still being built, and the other three are waiting on it.

**Shipped**
- **S1, login rate limits:** PR #576, merged to `main`. They now use the client's real IP instead of a header an attacker could fake.
- **S2, security headers:** PR #579, merged to `main`. Other sites can no longer embed the dashboard, admin or login pages. `/embed/*` and `/chat/*` still embed normally.
- **D4a, citation display pieces:** PR #578, merged into the release branch. These are the clickable source markers and the footnote list, not yet connected to the chat.

**In progress: D1, the test harness**
- It runs real retrieval against two OpenStax textbooks (economics and psychology) and a set of test questions with known answers, and its unit tests pass.
- It's now writing the mode that runs those questions through the real chat and scores the answers. Nothing is pushed yet, so there's no PR.
- Its draft baseline run says our hunch was right:
  - Off-topic questions still get course passages stuffed in every time (100%).
  - The median answer carries about 14,000 tokens of passages.
  - Finding the right passage looks perfect (recall 1.0, MRR 0.71), but that's flattering. The test material is small enough that we basically send all of it every time.
- One number looks wrong: page accuracy is 0. That's either a bug in the harness or page numbers not coming through for these files. I'll check it before the baseline counts.
- These numbers come from uncommitted code and I haven't checked them myself. They become the official baseline only once they're committed and reproduced in the PR.

**Waiting on D1**
- D2 (more relevant retrieval) starts once D1 merges.
- Then D3 (server-side citations).
- Then D4b (citations shown in chat).
- All of it lands on `main` together through release PR #575.
```

## 34. assistant — 2026-11-14 00:10:02.907 UTC

```text
Three of the seven pieces have shipped:

- **S1, login rate limits:** PR #576 merged to `main`; limits now use the client’s real IP rather than a spoofable header.
- **S2, security headers:** PR #579 merged to `main`; dashboard, admin, and login pages can’t be embedded by other sites. `/embed/*` and `/chat/*` still work.
- **D4a, citation display components:** PR #578 merged into the release branch; the clickable source markers and footnote list are built, but not yet connected to chat.

**D1, the evaluation harness, is in progress.** Retrieval against two OpenStax textbooks and its unit tests are done. The answer-mode runner, which tests questions through the real chat and scores answers, is being built. Nothing has been pushed yet, so there’s no PR.

An uncommitted draft baseline reports that off-topic questions get course passages every time (100%), with a median of about 14,000 passage tokens. Retrieval looks strong (recall 1.0, MRR 0.71), but the small test set means it may simply be sending nearly all available material. Page accuracy is 0; that may be a harness bug or missing page numbers. These figures haven’t been independently verified and aren’t official until committed and reproduced in a PR.

**D2 (more relevant retrieval), D3 (server-side citations), and D4b (citations in chat) are waiting on D1.** They’re planned to land together on `main` through release PR #575.
```

## 35. user — 2026-11-14 00:10:11.573 UTC

```text
do you need anything from me
```

## 36. assistant — 2026-11-14 00:10:18.506 UTC

```text
No, nothing is blocked on you. The keys you saved were the only thing I needed, and the test harness (D1) is using them now.

One optional thing that only you can check. The login rate-limit fix (S1) is only as good as your production proxy. It relies on the proxy setting `x-real-ip`, or on the real client IP being the last hop in `X-Forwarded-For`. Your PRs get Vercel preview comments, so I assume production runs on Vercel. As far as I know, Vercel sets `x-real-ip` itself (that's from training data; I haven't checked it here). If production sits behind something else, like Cloudflare or a custom proxy, tell me and I'll check that the fix still holds.

Otherwise I'll keep going. After D1 merges, the retrieval, citation and chat-wiring pieces run in order, and everything lands on `main` together through release PR #575. You'll hear from me if something breaks or when it's ready to review.
```

## 37. user — 2026-11-14 00:10:52.517 UTC

```text
yeah keep going
```

## 38. assistant — 2026-11-14 00:11:03.988 UTC

```text
I'll keep going. One correction before the harness (D1) records its baseline: I've told it to work out why page accuracy is 0, when its tests do find the right passages. Either the harness reads page numbers wrong, or the app really drops them for these PDFs. If it's a harness bug, it fixes it and adds a test. If the pages really are missing, that's a real finding. It goes into the PR, and the page links in the citations work (D3 and D4b) will have to account for it. The harness also has to say in the PR that its perfect passage-finding score is inflated, because the test material is small enough to fit in a single answer.

Once D1 merges, the retrieval changes (D2), server-side citations (D3) and the chat wiring (D4b) start one after another. Each must pass its spec checks before the next begins. I'll message you when the release PR #575 is ready, or sooner if something needs you.
```

## 39. assistant — 2026-11-14 00:11:06.860 UTC

```text
D1 is still running. I’ve asked it to investigate the zero page-accuracy result before recording the baseline, and to document that the perfect passage-recall score may be inflated by the small test set. No merges or release PR are confirmed yet. Once D1 merges, D2, D3, and D4b will proceed in sequence, each gated on its spec checks.
```

## 40. user — 2026-11-14 00:20:44.701 UTC

```text
stop everything
```

## 41. user — 2026-11-14 00:20:55.128 UTC

```text
<subthread-result thread-id="unknown" task="D3: Answer-level citation protocol (server)" status="cancelled">
Task reached terminal status: cancelled
<auto-failed-dependents>
Staged dependent tasks were auto-failed with this failure (never spawned):
- D4b: Wire citation footnotes into chat (todo_IL59x1kp)
Recreate them with `obvious tasks create --assignee=…` + `tasks start --dependencies` if the work is still needed.
</auto-failed-dependents>
</subthread-result>
```

## 42. assistant — 2026-11-14 00:21:13.752 UTC

```text
Everything is stopped. Nothing is running, and nothing new will start until you tell me to resume.

**What I stopped**
- **D1, test harness:** cancelled while it was running. It never pushed its branch, so none of its work is on GitHub. That includes the 71 test questions, the saved embeddings and the scoring code. Whatever was left in its private copy of the repo may be lost.
- **D2, D3 and D4b:** cancelled before they started. No branches or PRs were ever created for them.

**Already merged, so the stop doesn't affect it**
- #576 (login rate limits) and #579 (security headers) are on `main`.
- #578 (citation display pieces) is in `release/trustworthy-answers`, not in `main`.
- Draft release PR #575 is still open. I left it untouched.

If you want any of this back, I can restart the cancelled tasks and keep their existing plans. D1 would have to rebuild its harness from scratch.All work is stopped. No tasks are running, and nothing new will start unless you resume it.

- **D1 (evaluation harness):** Cancelled while running. Its branch was never pushed; no harness code, test questions, embeddings, or scoring work is on GitHub. Anything only in its private workspace may be lost.
- **D2, D3, and D4b:** Cancelled before starting; no branches or PRs were created.

Already merged and unaffected:
- **#576** (login rate limits) and **#579** (security headers) are on `main`.
- **#578** (citation display components) is on `release/trustworthy-answers`, not `main`.
- **Draft release PR #575** remains open and unchanged.

I can restart the cancelled tasks from their existing plans; D1 would need to rebuild its harness work.
```

## 43. assistant — 2026-11-14 00:21:15.534 UTC

```text
Everything is stopped. No tasks are running, and nothing new will start unless you ask me to resume.

- **D1 (evaluation harness)** was cancelled while running. Its branch was never pushed, so its harness work isn’t on GitHub; anything only in its private workspace may be lost.
- **D2, D3, and D4b** were cancelled before starting; no branches or PRs were created for them.
- **#576** (login rate limits) and **#579** (security headers) are already on `main`.
- **#578** (citation display components) is on `release/trustworthy-answers`, not `main`.
- Draft release PR **#575** remains open and unchanged.
```

## 44. user — 2026-11-17 21:31:28.566 UTC

```text
I am going to move off from obvious for this project so i need to move everything off from the obvious project, how can i do that
```

## 45. assistant — 2026-11-17 21:34:53.151 UTC

```text
Most of this project already lives outside Obvious, and I've exported the rest into a zip on your Mac. All the code is in `akhileshrangani4/teachanything` on GitHub. The documents are the only other thing that was stored here.

**The export:** `teachanything-obvious-export.zip`, 887 KB, saved in the project's `downloads/` folder on your Mac. A copy is also in the project's files. It contains:
- **The three research reports**, as Markdown.
- **The approved spec**, "Trustworthy answers + two security fixes": the original HTML plus a Markdown copy you can edit anywhere.
- **The task history:** every task's brief, acceptance criteria, status, outcome and comments. D1, D2, D3 and D4b were never built, so their briefs are what you need to resume that work somewhere else.
- **QA evidence:** the screenshots and screen recording from PRs #578 and #579.
- **A README** that maps it all and lists the steps below.

The chat conversations themselves aren't in it; only the task and comment history is.

**What's left for you, in order:**
1. **Draft PR #575.** It holds the citation components from #578, which aren't on `main` yet. Close it if you're dropping that work; keep the branch if you'll continue it.
2. **The two API keys.** Revoke them at OpenAI and OpenRouter. Then delete them from Obvious, which you have to do on the web: the desktop app only shows secrets read-only.
3. **Obvious's GitHub access.** Uninstall or restrict the Obvious GitHub App under GitHub → Settings → Applications. The registered repo sandboxes can go too.
4. **The project itself.** Archive or delete it once you've checked the zip.

I haven't deleted anything. The PRs that already merged keep a footer of Obvious links in their descriptions, which will stop working after the project is deleted; the code isn't affected.
```

## 46. assistant — 2026-11-17 21:34:56.648 UTC

```text
Most of the project already lives outside Obvious: the code is in `akhileshrangani4/teachanything` on GitHub. I exported the remaining project materials to **`teachanything-obvious-export.zip`** (887 KB), saved in the project’s `downloads/` folder on your Mac. A copy is also in the project’s files.

The zip contains:
- Three research reports in Markdown.
- The approved “Trustworthy answers + two security fixes” spec, in its original HTML and a Markdown copy.
- Task history, including briefs, acceptance criteria, statuses, outcomes, and comments. D1, D2, D3, and D4b were never built, so their briefs can help you resume elsewhere.
- QA screenshots and a screen recording from PRs #578 and #579.
- A README with an index and offboarding checklist.

The chat conversations themselves aren’t included—only task and comment history.

Before closing out Obvious:
1. **Review draft PR #575.** It contains citation components from #578 that aren’t on `main` yet. Close it if you’re dropping that work; keep the branch if you plan to continue it.
2. **Revoke the two API keys** at OpenAI and OpenRouter, then delete them from Obvious. Secret deletion must be done on the web; the desktop app shows secrets read-only.
3. **Remove or restrict Obvious’s GitHub access** under GitHub → Settings → Applications. You can also remove the registered repo sandboxes.
4. **Archive or delete the Obvious project** after checking the zip.

I haven’t deleted anything. Merged PR descriptions still contain Obvious links that will stop working if you delete the project; the code won’t be affected.
```

## 47. user — 2026-11-17 21:36:40.491 UTC

```text
wait just look at actually what the heel implementation factory did and ask me questions on where to put everythuing
```

## 48. assistant — 2026-11-17 21:37:42.233 UTC

```text
The heel work is in GitHub already: its code and PRs are on `release/heel-v0.1`; the Obvious artifacts were research docs, a build spec, and PR mirrors. I’ve asked where you want each part of the Teach Anything research, chat history, QA evidence, and draft PR #575 to go before moving anything.
```

## 49. user — 2026-11-17 21:49:06.445 UTC

```text
Question Responses:

Where should the documents go (research, spec, task history)?
Repo: new docs/design/ folder on main, via a small docs PR

Export chat history as Markdown? (Your messages and mine only. Tool output is left out.)
This thread plus the worker threads, including D1's never-pushed harness design

Where should the 11 QA screenshots and recordings (~1 MB) go?
Keep them only in the Mac zip, not in git

What should happen to draft release PR #575 and release/trustworthy-answers? They hold the citation components from #578, which aren't on main.
Leave it open as it is for now

After the export is verified, delete this Obvious project?
No, keep it for now
```

## 50. assistant — 2026-11-17 21:49:55.085 UTC

```text
The export to the repo has started, but nothing is committed yet. A coder is preparing one small docs PR into `main` on the branch `docs/export-design-docs`, and will merge it once CI passes.

Everything goes in a new `docs/design/` folder:
- **Documents:** the three research reports, the spec and the task history as Markdown, plus a `README.md`. The README indexes the files and records what shipped where:
  - S1 and S2 are on `main`.
  - D4a is only on `release/trustworthy-answers`.
  - D1–D4b were never built.
- **Chat history:** a `chat/` subfolder with this build thread and one file per worker thread, including D1's. Your messages and mine only, oldest first, with timestamps.

Before it merges, the coder has to show nothing was lost and nothing sensitive went in:
- **Documents:** the heading and table counts must match the originals.
- **Chat:** each thread's message count must match.
- **Secrets:** a scan must confirm no API key values are included.
- **Scope:** nothing outside `docs/design/` changes.

As you chose, the QA screenshots and recordings stay in the zip on your Mac. #575, its branch and the Obvious project are untouched.
```

## 51. assistant — 2026-11-17 21:49:57.597 UTC

```text
The export is **in progress, not yet committed or merged**. A coder is preparing a small docs PR to `main` from branch `docs/export-design-docs`.

The export will go in `docs/design/` and include the three research reports, spec, task history, a `README.md`, and a `chat/` subfolder with this build thread and each worker thread—including D1’s—containing only your messages and mine, oldest first, with timestamps. The README will record that S1 and S2 are on `main`, D4a is only on `release/trustworthy-answers`, and D1–D4b were never built.

Before merge, the coder must verify document heading and table counts, chat message counts, that no API key values are included, and that no files outside `docs/design/` changed. The QA screenshots and recordings will stay in the zip on your Mac. Draft release PR #575, its branch, and the Obvious project will remain untouched.
```
