# Chat: S2: App-wide security headers, embed-aware

- **Source thread:** `th_Ka5PL9uH`
- **Task:** `todo_ajZ69NUG` ("S2: App-wide security headers, embed-aware")
- **Exported:** 2026-11-17 (messages up to 2026-11-13 23:42:06.576 UTC)
- **Messages:** 7 user and assistant text messages, out of 155 thread entries; tool calls, tool results and reasoning are omitted.

Each message is reproduced verbatim inside a text fence, oldest first. `user` is the role the platform recorded: it covers Akhilesh Rangani's own messages and platform-delivered ones (task briefs, run-engine steps, GitHub signals, sub-thread results, reminders). `assistant` is the Obvious agent.

## 1. user — 2026-11-13 23:23:19.883 UTC

```text
## Assigned computer
Use `computerId: "cmp_m3rUfWXx"` for source, edits, builds, tests, and git. Keep file-consuming commands on the computer holding those files. Platform-only operations can use obvious-sdk.

[AUTOBUILD] Pre-assigned branch: fix/security-headers
You MUST use this branch for your work.
[AUTOBUILD] Assigned subtask: todo_ajZ69NUG
[AUTOBUILD] Acceptance criteria (mustHaves):
- The codebase areas touched by the brief are identified and understood well enough to write a grounded spec.
- CI is green on every PR and the acceptance criteria are met. Applicable visual PRs have evidence recorded against their tested head SHA before merge, or backend-only work has a concrete visual-evidence exception.

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
```

## 2. user — 2026-11-13 23:38:54.474 UTC

```text
GitHub comment signal batched (1):
• vercel[bot] commented on #579: [vc]: #nYpb8E4gTepJLslSFs+/AyGRqoOKBRwKKjP5umT9BwM=:eyJpc01v… (akhileshrangani4/teachanything)
```

## 3. user — 2026-11-13 23:39:05.992 UTC

```text
Signal batch received (1 comment signal) — agent wake requested
```

## 4. user — 2026-11-13 23:39:13.113 UTC

```text
GitHub PR activity signals batched (2):
• obvious-autobuild[bot] · PR labeled: feat(security): add app-wide security headers with embed-aware framing (akhileshrangani4/teachanything)
• obvious-autobuild[bot] · PR labeled: feat(security): add app-wide security headers with embed-aware framing (akhileshrangani4/teachanything)
```

## 5. user — 2026-11-13 23:41:18.203 UTC

```text
GitHub comment signal batched (1):
• codecov[bot] commented on #579: ## [Codecov](https://app.codecov.io/gh/akhileshrangani4/teac… (akhileshrangani4/teachanything)
```

## 6. user — 2026-11-13 23:41:29.762 UTC

```text
Signal batch received (1 comment signal) — agent wake requested
```

## 7. user — 2026-11-13 23:41:56.461 UTC

```text
## 🎉 PR Merged: [#579 feat(security): add app-wide security headers with embed-aware framing](https://github.com/akhileshrangani4/teachanything/pull/579)

**Repository:** akhileshrangani4/teachanything
**Author:** @obvious-autobuild[bot]
**Merged:** Nov 13, 11:41 PM
**Changes:** +167 / -0 lines
```
