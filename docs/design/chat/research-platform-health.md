# Chat: Research: platform reliability, performance, security & developer experience

- **Source thread:** `th_JF7nohUZ`
- **Task:** `todo_L4ev0Wfu` ("Research: platform reliability, performance, security & developer experience")
- **Exported:** 2026-11-17 (messages up to 2026-11-13 23:08:12.099 UTC)
- **Messages:** 1 user and assistant text messages, out of 101 thread entries; tool calls, tool results and reasoning are omitted.

Each message is reproduced verbatim inside a text fence, oldest first. `user` is the role the platform recorded: it covers Akhilesh Rangani's own messages and platform-delivered ones (task briefs, run-engine steps, GitHub signals, sub-thread results, reminders). `assistant` is the Obvious agent.

## 1. user — 2026-11-13 23:01:11.523 UTC

```text
## Assigned computer
Use `computerId: "cmp_m3rUfWXx"` for source, edits, builds, tests, and git. Keep file-consuming commands on the computer holding those files. Platform-only operations can use obvious-sdk.

[AUTOBUILD] Pre-assigned branch: task/research-platform-reliability-performanc-L4ev0Wfu
You MUST use this branch for your work.
[AUTOBUILD] Assigned subtask: todo_L4ev0Wfu
[AUTOBUILD] Acceptance criteria (mustHaves):
- The codebase areas touched by the brief are identified and understood well enough to write a grounded spec.
- CI is green on every PR and the acceptance criteria are met. Applicable visual PRs have evidence recorded against their tested head SHA before merge, or backend-only work has a concrete visual-evidence exception.

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
```
