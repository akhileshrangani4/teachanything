# Design records: platform research, trustworthy-answers spec and build history

Exported from the Obvious project "Teach Anything platform research" on 2026-11-17, so these records live with the code. Everything here was planned or discussed in Obvious; GitHub is the record of what was implemented (see [Implementation](#implementation)).

## Files

| File | What it is |
| --- | --- |
| [research-ai-tutoring-core.md](research-ai-tutoring-core.md) | Research: RAG retrieval, prompts, models and pedagogy. Findings and ranked improvements. |
| [research-product-gaps.md](research-product-gaps.md) | Research: product and feature gaps for professors, students and admins, ranked. |
| [research-platform-health.md](research-platform-health.md) | Research: reliability, security, performance, CI and developer experience, ranked. |
| [spec-trustworthy-answers.md](spec-trustworthy-answers.md) | The approved spec "Trustworthy answers + two security fixes" (D1–D4, S1–S2), converted from its Blueprint. |
| [task-history.md](task-history.md) | Every task under the build's root task: title, status, assignee, brief and completion note. |
| [chat/orchestration.md](chat/orchestration.md) | The orchestration chat: the user's requests and decisions, and the agent's plans and status reports. |
| [chat/research-ai-tutoring-core.md](chat/research-ai-tutoring-core.md) | Brief for the AI tutoring core research worker. |
| [chat/research-product-gaps.md](chat/research-product-gaps.md) | Brief for the product gaps research worker. |
| [chat/research-platform-health.md](chat/research-platform-health.md) | Brief for the platform health research worker. |
| [chat/d1-eval-harness.md](chat/d1-eval-harness.md) | D1 worker chat (retrieval and answer evaluation harness). |
| [chat/d1-eval-harness-design-record.md](chat/d1-eval-harness-design-record.md) | D1's design, reconstructed from the worker's recorded activity: its local commits, the files it wrote, and its two READMEs. D1 was never pushed, so this is the only copy. |
| [chat/d4a-citation-ui.md](chat/d4a-citation-ui.md) | D4a worker chat (citation UI components). |
| [chat/s1-trusted-ip-rate-limits.md](chat/s1-trusted-ip-rate-limits.md) | S1 worker chat (login and registration rate limits on the trusted client IP). |
| [chat/s2-security-headers.md](chat/s2-security-headers.md) | S2 worker chat (app-wide, embed-aware security headers). |

Chat files keep user and assistant text messages only, verbatim and oldest first; tool calls, tool results and reasoning are left out. Each chat file names its source thread and task.

## Implementation

| Item | Status | Where |
| --- | --- | --- |
| S1: rate limits keyed on the trusted client IP | Merged to `main` | [#576](https://github.com/akhileshrangani4/teachanything/pull/576) (`5f03da4`) |
| S2: app-wide security headers, embed-aware | Merged to `main` | [#579](https://github.com/akhileshrangani4/teachanything/pull/579) (`a079d17`) |
| D4a: citation UI components | On `release/trustworthy-answers` only, not on `main` | [#578](https://github.com/akhileshrangani4/teachanything/pull/578) (`30be5a2`) |
| D1: eval harness | Not built: stopped before push; see the design record | — |
| D2: retrieval precision | Not built | — |
| D3: answer-level citation protocol | Not built | — |
| D4b: citation footnotes wired into chat | Not built | — |

The release PR [#575](https://github.com/akhileshrangani4/teachanything/pull/575) (`release/trustworthy-answers` into `main`) is an open draft and is left as it is.

## Not in git

QA screenshots and recordings from the S1, S2 and D4a work are not committed here. They stay in the user's local export zip (`teachanything-obvious-export.zip`).
