# Chat: Research: product & feature gaps (professor, student, admin surfaces)

- **Source thread:** `th_eIDtGcR6`
- **Task:** `todo_Kew0OkLt` ("Research: product & feature gaps (professor, student, admin surfaces)")
- **Exported:** 2026-11-17 (messages up to 2026-11-13 23:06:25.214 UTC)
- **Messages:** 1 user and assistant text messages, out of 71 thread entries; tool calls, tool results and reasoning are omitted.

Each message is reproduced verbatim inside a text fence, oldest first. `user` is the role the platform recorded: it covers Akhilesh Rangani's own messages and platform-delivered ones (task briefs, run-engine steps, GitHub signals, sub-thread results, reminders). `assistant` is the Obvious agent.

## 1. user — 2026-11-13 23:01:09.572 UTC

```text
## Assigned computer
Use `computerId: "cmp_m3rUfWXx"` for source, edits, builds, tests, and git. Keep file-consuming commands on the computer holding those files. Platform-only operations can use obvious-sdk.

[AUTOBUILD] Pre-assigned branch: task/research-product-feature-gaps-professor-Kew0OkLt
You MUST use this branch for your work.
[AUTOBUILD] Assigned subtask: todo_Kew0OkLt

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
```
