> Exported from Obvious document `art_ktM9QU8j` ("Platform health: reliability, security, performance, CI and DX — ranked findings") on 2026-11-17. Content is unchanged from the live source.

# Platform health: reliability, security, performance, CI and DX — ranked findings

**Repo:** `akhileshrangani4/teachanything` @ `main` (read-only review, 2026-11-13). No code was changed.
**Evidence convention:** **Observed** = I read it in the cited file. **Inferred** = my reasoning about impact, not measured. No production metrics, logs or deployment config were available to me, so no finding claims a measured impact.
**Backlog check:** I ran `gh issue list --state open --limit 200` (11 open issues) and `gh pr list --state open` (9 open PRs). **None of the five ranked findings has a backing open issue.** Each one would need a new issue. None overlaps the Issue Triage off-limits list. Where a finding touches an off-limits item, the overlap check says how.

---

## 1. Map of what was explored

I started with `AGENTS.md` (incl. §15: no dependency or tool-config changes without an explicit ask) and `CONTRIBUTING.md`/`SETUP.md`. Then I covered:

- **tRPC routers and authorization:** the `apps/web/src/server/trpc.ts` middleware chain and the chatbot, files, analytics, crawler, auth and admin routers. Ownership helpers are `assertOwnedChatbot` (`server/queries/chatbot.ts:34`) and `assertOwnedCrawlSource`/`assertOwnedCrawledPage` (`routers/crawler/helpers.ts:21,48`).
- **Rate limiting:** every limiter in `server/rate-limit.ts`, how fail-open/fail-closed works (`:195-289`), the edge proxy (`src/proxy.ts`), the Better Auth route handler and Better Auth's built-in limiter.
- **Logging and observability:** `packages/logger/src/index.ts`, the tRPC logging middleware, `instrumentation.ts`, the client error boundaries and `package.json` dependencies.
- **DB schema indexes:** `packages/db/src/schema.ts`, `setup-indexes.sql` and the migrations.
- **Hot queries:** chatbot list, Student Chats list and search, and the admin export.
- **Client polling and the stale-file sweep:** `hooks/file-polling.ts`, `server/file-stale.ts`.
- **Next.js page rendering:** `"use client"` on pages, heavy client imports and dynamic imports.
- **QStash job routes:** `app/api/jobs/*` plus the Resend webhook.
- **CI:** `.github/workflows/*`, `codecov.yml`, `dependabot.yml`, Jest configs and coverage thresholds.
- **The test inventory:** 126 test files.
- **Better Auth 1.7.5:** the sign-in source in `node_modules`, to check the seed issue.

**Overall:** authorization is in good shape. Every procedure I sampled that takes a chatbot, file, conversation or crawl id scopes it to `ctx.session.user.id` or calls an `assertOwned*` helper. I found **no IDOR**. The gaps are around the edges: inconsistent client-IP identity for limiters, a broken demo seed, DB-backed and authorization tests that never run in CI, thin production observability, and no app-wide security headers.

---

## 2. Ranked top 5

Ranking weighs verified defect over hypothesis first, then breadth of who benefits, then size.

### #1 — Unify client-IP identity and close gaps in rate limiting (security / reliability)

**What:** Make every IP-keyed limiter use the trusted-IP helper. Separate the page-load and chat-API buckets so a classroom behind one campus NAT isn't throttled. Either wire up or delete the unused `adminActionRateLimit`.

**Observed:**
- `app/api/auth/[...all]/route.ts:18-20` keys **login** (`loginRateLimit`, 5 per 15 min, `rate-limit.ts:83-86`) and **registration** (3 per hour, `:90-93`) on `x-forwarded-for.split(",")[0]`. That is the **leftmost** hop.
- `lib/get-client-ip.ts:3-15` explicitly documents the leftmost hop as client-controlled and spoofable. The helper uses `x-real-ip`, then the **rightmost** hop. `proxy.ts:24` and `api/chat/shared/route.ts:40` use that helper. The auth route does not.
- `checkRateLimit` defaults to `failOpen = true` (`rate-limit.ts:211-248`). The login and registration limits allow requests when Redis errors or is absent.
- Better Auth's built-in limiter is on in production by default, but its storage is **in-memory per instance** unless `secondaryStorage` is set (`node_modules/better-auth/dist/context/create-context.mjs:170-175`). I saw no `rateLimit`/`secondaryStorage` option in the app's auth config. On serverless, that backstop is per-instance.
- The proxy applies `publicChatRateLimit` (10 per 10 s, `rate-limit.ts:37-40`) keyed on **IP alone** to every `/chat/*` page load **and** `/api/chat/shared` (`proxy.ts:23-28`). The route then applies the same limiter keyed `${shareToken}:${ip}` (`shared/route.ts:44`). So each shared-chat message consumes from two buckets, and the IP-only bucket also counts page navigations.
- The comment on `publicChatGlobalRateLimit` (`rate-limit.ts:42-47`) says the per-token cap is "well above the per-IP limit so a legitimate multi-student classroom isn't throttled". The proxy's IP-only bucket undercuts that intent for students who share an egress IP.
- `adminActionRateLimit` is defined at `rate-limit.ts:127-130` and has no caller in a source-wide search.

**Inferred:**
- Whether the leftmost-XFF key can be spoofed depends on the hosting edge. If the edge appends to a client-sent XFF instead of overwriting it, an attacker can rotate the leftmost value and get a fresh login bucket on every request. That defeats the 5 per 15 min password-guessing cap.
- A classroom of N students behind one NAT shares a 10-per-10-s budget across page loads and messages.

**Who benefits:** Students (no false 429s in labs and lecture halls). Professors and admins (credential-stuffing resistance). Operators (one IP rule to reason about).

**Size:** S (one PR): swap to `getTrustedClientIp` in the auth route, split or rekey the proxy bucket, decide the fate of `adminActionRateLimit`, and add unit tests.

**Risks:** Changing proxy limits changes abuse exposure for public chat. The per-token global cap (300/min) stays as the spend backstop. If the edge does not set `x-real-ip`, the helper falls back to the rightmost hop, which must be verified on the real host.

**Overlap check:** None. #465 is a per-session turn lock, not rate limiting. #480 removes an endpoint and does not touch limiter identity.

---

### #2 — Fix the demo seed so documented logins work (DX)

**What:** Seed credential `account` rows with `account_id = user.id` (Better Auth's own shape), or create users through Better Auth's API.

**Observed:**
- `packages/db/scripts/seed.ts:207-229` inserts `account` rows with `account_id` set to the **email** (`${adminEmail}`, `'professor@demo.edu'`, `'student@demo.edu'`).
- Better Auth 1.7.5 sign-in looks up the credential account with `account.providerId === "credential" && account.accountId === userRecord.user.id` (`node_modules/better-auth/dist/api/routes/sign-in.mjs:316`). Its own sign-up writes `accountId: createdUser.id` (`.../sign-up.mjs:245`).
- `SETUP.md:68-69` advertises `professor@demo.edu / demo123` and `student@demo.edu / demo123`. `CONTRIBUTING.md:61` tells contributors to log in with the seeded credentials.

**Inferred:** Every seeded login fails as "invalid credentials" on the first-run path in CONTRIBUTING. I did not run the seed against a live DB. The conclusion comes from reading both sides of the comparison.

**Who benefits:** New contributors and maintainers (operators) running locally; reviewers reproducing professor/admin flows.

**Size:** S (one small PR). Add a test that asserts the seed's account shape matches what sign-in reads, so a future Better Auth bump cannot silently break it again.

**Risks:** Existing local DBs keep the bad rows. The seed's "Admin already exists" branch (`seed.ts:199-200`) skips re-insert, so the fix needs a one-line repair (UPDATE) or a "reseed" note.

**Overlap check:** Explicitly listed as flagged-but-not-owned by Issue Triage. No open issue.

---

### #3 — Run DB-backed suites in CI and add authorization/admin regression tests (test/CI)

**What:**
- (a) Give the test workflow a Postgres with `vector` + `pg_trgm` so the `TEST_DATABASE_URL`-gated suites actually run.
- (b) Add router-level tests (via `createCaller`) asserting that a second user gets NOT_FOUND/FORBIDDEN on another user's chatbot, file, conversation and crawl-source ids.
- (c) Cover `admin.deleteUser` error mapping.

**Observed:**
- `__tests__/server/analytics-common-questions.test.ts:50` and `question-normalization.test.ts:66` use `TEST_DATABASE_URL ? describe : describe.skip`.
- `.github/workflows/test.yml` runs only `npm ci` and `npm run test -- -- --coverage` (`:36,39`) with **no `services:` block** and no `TEST_DATABASE_URL`, so both suites skip in CI.
- The other ~18 server tests set a dummy `DATABASE_URL` and mock the DB.
- No test file references the chatbot/files/analytics/crawler routers through `createCaller` or `appRouter`. A grep for router entry points in `__tests__` only hits auth, files-storage-cleanup, rate-limit and common-questions suites. Ownership checks exist today: a grep heuristic counts 11 in the chatbot router, 14 in files, 20 in analytics and 42 in crawler. No test pins any of them.
- `admin/procedures/user-status.ts:213-234` maps `StorageCleanupError` to a retryable message and everything else to a generic failure. No admin test exists (grep for `admin` in `__tests__` hits auth and env suites only).
- Coverage gates are low: web `lines: 4`, `branches: 30` (`apps/web/jest.config.ts`); ai and db `lines: 10`.

**Who benefits:** Every user indirectly. Operators and maintainers get the most: a refactor that drops an `assertOwnedChatbot` call would fail CI instead of shipping an IDOR.

**Size:** M (2–3 PRs): CI Postgres, ownership regression suite, admin router tests.

**Risks:**
- Under **AGENTS.md §15**, workflow and tool-config changes and new dependencies (PGlite) need an explicit maintainer ask. Get that sign-off first.
- PGlite's support for `vector`/`pg_trgm` is from my training knowledge and was not checked this session. A `pgvector/pgvector` service container is the more conservative choice.
- New ESM-mocked suites must follow the `jest.unstable_mockModule` + `await import()` pattern.

**Overlap check:** Touches two off-limits areas without owning them.
- **#399** (Jest ESM overhaul): coordinate so new suites use whatever pattern #399 settles on.
- **#315** (Common Questions normalization): this finding only makes its existing tests *execute* and does not change normalization logic.

---

### #4 — Production observability baseline (observability)

**What:**
- Classify expected tRPC errors (NOT_FOUND, BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, TOO_MANY_REQUESTS, CONFLICT) as warn/info instead of `[ERROR]`.
- Make security-relevant warnings visible without the global `ENABLE_LOGGING` switch.
- Route server and client errors to an error tracker, which needs a dependency, so it requires maintainer sign-off.

**Observed:**
- `packages/logger/src/index.ts:3` sets `LOG_ENABLED = process.env.ENABLE_LOGGING === "true"`. `logWarn`/`logInfo` (`:163-182`) only emit when it is set. `logError` always emits (`:154`). `apps/web/.env.example:65` ships `# ENABLE_LOGGING=` commented out.
- The warnings that disappear include "Unauthorized access attempt", "Unapproved user access attempt" and "Non-admin access attempt to admin endpoint" (`server/trpc.ts:75,86,106`). Limiter failures also log here (`rate-limit.ts:235-240`).
- The tRPC `loggingMiddleware` (`server/trpc.ts:52-65`) calls `logError` for **every** thrown procedure error. That includes the 57 intentional `appError("NOT_FOUND"|"FORBIDDEN"|…)` throws counted across `server/`. Real faults (92 `logError` sites in total) sit in the same `[ERROR]` stream as expected 4xx.
- Client error boundaries (`app/error.tsx`, plus `(dashboard)/error.tsx` and `chatbot/error.tsx`) only `console.error` in the browser, so operators never see client crashes.
- `instrumentation.ts:3-18` only prints disabled services. `package.json` has `@vercel/analytics` and no Sentry or OpenTelemetry.

**Inferred:** With `ENABLE_LOGGING` unset in prod, a brute-force or IDOR-probing pattern leaves no trace. With it set, true errors are buried under expected 4xx noise. I don't know which state prod is in (see open questions).

**Who benefits:** Operators and admins (faster incident detection). Professors and students indirectly (failures in chat and uploads get noticed without a user report).

**Size:** M (2–3 PRs): error classification in middleware, always-on security warnings, then an error-tracker integration plus a client-boundary hook.

**Risks:**
- Adding Sentry or OTel is a dependency change and needs an explicit ask under AGENTS.md §15.
- PII in log context: `deleteUser` already logs email (`user-status.ts:223-226`), so a redaction policy should come before shipping logs off-box.
- Downgrading log levels must not hide genuine INTERNAL_SERVER_ERRORs.

**Overlap check:** None. #462 and #463 add file-pipeline visibility only. This finding is app-wide and does not touch the file pipeline.

---

### #5 — App-wide security headers with embed-aware framing (security hardening)

**What:** Add `headers()` in `next.config.js` (or set them in `proxy.ts`):
- `frame-ancestors 'none'` / `X-Frame-Options: DENY` for dashboard, admin and auth routes
- an explicit allow for `/embed/*` (and `/chat/*` if it is meant to be framed)
- `X-Content-Type-Options: nosniff`, `Referrer-Policy` and HSTS

**Observed:**
- `apps/web/next.config.js` has no `headers` key (a grep for `headers|X-Frame|Content-Security` returns nothing).
- The only header hardening in the app is per-route in the file download handler (`X-Content-Type-Options: nosniff` and `X-Frame-Options: SAMEORIGIN` at `:111-112`).
- Public embed routes exist and must stay frameable: `app/embed/[shareToken]/window/page.tsx` and `button/page.tsx`.
- Admin destructive actions exist (`admin.deleteUser`, `user-status.ts:192`).

**Inferred:**
- Any page, including `/admin`, can be framed by a third-party site, so clickjacking is possible against a logged-in admin.
- Exploitation needs a lured, authenticated admin, so severity is moderate, not critical.
- I did not check whether the hosting platform injects any headers.

**Who benefits:** Admins and professors (session-bound actions can't be clickjacked). Operators (one place to reason about headers).

**Size:** S (one PR) for framing, nosniff, referrer policy and HSTS. A full script CSP is larger (M) because of inline scripts and third-party analytics, and should be a follow-up decision.

**Risks:** A wrong matcher breaks LMS embeds of `/embed/*`, which professors rely on, so it needs an explicit test of framing on embed routes. HSTS is sticky; start with a short max-age.

**Overlap check:** None.

---

## 3. Considered and rejected (or deferred)

- **IDOR fixes on chatbot/file/conversation ids:** rejected. No gap found in the sampled procedures (e.g. `assertOwnedChatbot` at `analytics/procedures/conversations.ts:32,173,263`; chatbot list scoped by `chatbots.userId` at `chatbot/queries.ts:43-44`). The useful work is the regression tests in #3.
- **Missing FK indexes on `chatbots.user_id`, `account.user_id`, `session.user_id`:** deferred, runner-up #6. Observed: these tables (`schema.ts:111-205`) have no index block, and no migration or `setup-indexes.sql` adds one. Sign-in reads accounts by user id, and the dashboard lists chatbots by user. It is cheap (S), but the benefit at current table sizes is unmeasured.
- **Student Chats query shape:** deferred until `EXPLAIN` is run on production-sized data. `buildMessageStatsSubquery` aggregates every message of the chatbot before `LIMIT/OFFSET` (`analytics/procedures/conversations.ts:34,211`). The cost should grow with chatbot history, but this is unbenchmarked. The page is not polled (no `refetchInterval` in analytics), which limits the blast radius.
- **Next.js client-component and bundle work:** deferred. 16 of 19 `page.tsx` files are `"use client"`, and recharts and shiki are imported in client components. I could not measure bundle size without a production build, so any gain would be speculation.
- **Pin third-party GitHub Actions to SHAs:** rejected for the top 5. All actions are tag-pinned (e.g. `tj-actions/changed-files@v47`, `crazy-max/ghaction-github-labeler@v6.0.0`). Dependabot covers the `github-actions` ecosystem. It is a real supply-chain hardening, but low marginal value, and it is a workflow/tool-config change that needs a §15 ask.
- **Cost controls (per-chatbot token budgets, spend metering):** rejected as overlapping the AI-tutoring track's "token-usage metering" recommendation (`art_0xSIXg3p`).
- **QStash failure callback / dead-letter queue for email and crawl jobs:** rejected. Every job route verifies the QStash signature (`app/api/jobs/*/route.ts`), and email jobs get 5 retries (`server/qstash.ts:120`). The remaining email work sits next to #136/#340, and the file-job equivalent is #463.
- **Resend webhook hardening:** rejected. It already does HMAC with `timingSafeEqual` and timestamp-tolerance replay protection (`app/api/webhooks/resend/route.ts:52-100`).
- **Public share-token data exposure:** rejected. `getByShareToken` selects an explicit column list that excludes the system prompt and owner id (`chatbot/queries.ts:100-128`).
- **File polling and stale-sweep load:** rejected. Polling stops when no file is pending or processing (`hooks/file-polling.ts`), and the sweep is throttled to once per 60 s per user (`server/file-stale.ts`). It is also file-pipeline territory.
- **PR-time migration-vs-schema check:** rejected as adjacent to #515 (schema-drift deploy check).
- **Raising coverage thresholds:** rejected as a standalone item. The thresholds (`lines: 4` web) are a symptom. #3 adds the meaningful coverage, and threshold changes are tool config under §15.
- **Admin export size (`export-data.ts` loads all users, chatbots and domains in one query):** rejected. It is admin-only, infrequent and bounded by user count, with no evidence it is slow.

---

## 4. Open questions

1. **Hosting edge:** Is production on Vercel (it has `@vercel/analytics`), and does the edge overwrite or append `X-Forwarded-For` and set `x-real-ip`? This decides whether #1's auth-route spoofing is exploitable or only inconsistent.
2. **Production logging:** Is `ENABLE_LOGGING=true` set in production, and is there a log drain? This decides whether #4 starts with noise reduction or with visibility.
3. **Dependencies:** Will the maintainer approve a new dependency (Sentry, or OTel plus an exporter) under AGENTS.md §15? If not, #4 shrinks to log classification and structured logs.
4. **CI database:** Is a workflow change acceptable for a Postgres service container, and which is preferred: a `pgvector/pgvector` service or PGlite (extension support unverified)?
5. **Classroom networks:** How many students typically share one egress IP? This sets the right proxy bucket size in #1.
6. **Analytics data volume:** What are the largest chatbots' message counts in production? This decides whether the Student Chats query (deferred) should move into the top 5.
7. **Framing:** Is `/chat/[shareToken]` meant to be framed by LMSes (Canvas, Moodle), or only `/embed/*`? This sets #5's allowlist.
