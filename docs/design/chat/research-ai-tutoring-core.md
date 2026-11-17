# Chat: Research: AI tutoring core — RAG retrieval, prompts, models, pedagogy

- **Source thread:** `th_9a6BvAqr`
- **Task:** `todo_Mhuo5Kdu` ("Research: AI tutoring core — RAG retrieval, prompts, models, pedagogy")
- **Exported:** 2026-11-17 (messages up to 2026-11-13 23:06:18.543 UTC)
- **Messages:** 1 user and assistant text messages, out of 73 thread entries; tool calls, tool results and reasoning are omitted.

Each message is reproduced verbatim inside a text fence, oldest first. `user` is the role the platform recorded: it covers Akhilesh Rangani's own messages and platform-delivered ones (task briefs, run-engine steps, GitHub signals, sub-thread results, reminders). `assistant` is the Obvious agent.

## 1. user — 2026-11-13 23:01:10.575 UTC

```text
## Assigned computer
Use `computerId: "cmp_m3rUfWXx"` for source, edits, builds, tests, and git. Keep file-consuming commands on the computer holding those files. Platform-only operations can use obvious-sdk.

[AUTOBUILD] Pre-assigned branch: task/research-ai-tutoring-core-rag-retrieval-Mhuo5Kdu
You MUST use this branch for your work.
[AUTOBUILD] Assigned subtask: todo_Mhuo5Kdu
[AUTOBUILD] Acceptance criteria (mustHaves):
- The codebase areas touched by the brief are identified and understood well enough to write a grounded spec.
- CI is green on every PR and the acceptance criteria are met. Applicable visual PRs have evidence recorded against their tested head SHA before merge, or backend-only work has a concrete visual-evidence exception.

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
```
