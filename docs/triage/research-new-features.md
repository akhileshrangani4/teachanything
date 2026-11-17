> Research document: teachanything new features.
> Exported from the Obvious project _Teachanything Issue Triage_ on 2026-11-17. Source: `art_ZiqEZVVy`.

# Research — teachanything new features (#559, #315, #131, #137, #128)

Read-only research on `akhileshrangani4/teachanything` at `origin/main` (13 Nov 2026). No code was changed, nothing was pushed, and no PRs were opened. Line numbers refer to `origin/main` on that date. Anything not checked in the repo during this session is marked **(unverified)**.

## Summary

| Issue                      | State on `main`                                                                                    | Recommended next step                                                                               | PRs                          | Blocked on owner?                    |
| -------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------ |
| **#559** rate AI responses | Not started. Scope agreed. Assigned to **@gum1x** ("Working on This", 8 Nov)                       | Build as specified, but fix two gaps in the spec first (reload persistence, date range)             | 3 (M–L)                      | Yes: 3 decisions, plus who builds it |
| **#315** semantic grouping | Exact-match grouping shipped in #305/#317                                                          | Owner picks a rung. Rung 1 (normalization) is a 1-PR quick win                                      | 1 (rung 1/2) to 3 (rung 3/4) | Yes: which rung                      |
| **#131** session insights  | **Every acceptance criterion is already met on `main`** (PRs #305 and #317)                        | Close it. The "quality signals" gap it mentions is what #559 delivers                               | 0                            | Yes: confirm closing                 |
| **#137** newsletter        | Not started. PR #282 was closed by the owner, who postponed the feature pending product validation | Don't build until the owner confirms the product. The spec's Audiences API is now Resend "Segments" | 2 if greenlit                | Yes: go/no-go, plus which segment    |
| **#128** RTF support       | Not supported. `officeparser` 6.1.0 (already a dependency) can parse RTF                           | 1 small PR. Merge after or rebase onto #561/#550, which touch the same 7 files                      | 1 (S)                        | No                                   |

**Overlap in one line:** #131 is finished, and #559's analytics card plus #315's grouping both build on its code. #559 conflicts at the file level with open PR #560 (same author). #128 conflicts with open PRs #561/#550. #137 is independent but shares Resend config with the existing approved-user segment sync.

---

## Repo conventions

Sources: `AGENTS.md`, `CONTRIBUTING.md`, package manifests, `packages/db/drizzle.config.ts`.

- **Package manager / build:** npm 11 workspaces with Turborepo. Apps: `apps/web` (Next.js) and `apps/docs`. Packages include `packages/db` and `packages/ai`.
- **Checks:** `npm run lint`, `npm run check-types`, `npm run test` (Jest). Web tests live in `apps/web/src/__tests__/{server,lib,components,hooks}/`. AI-package tests live in `packages/ai/src/__tests__/`.
- **DB / ORM:** Drizzle on Postgres plus pgvector. The schema is `packages/db/src/schema.ts` (734 lines). Migrations are generated with `npm run db:generate` into `packages/db/drizzle/`; the latest is `0020_user_files_user_id_idx.sql`, so the next one is `0021_*`. They are applied with `npm run db:migrate`. `drizzle.config.ts` has `strict: true`. #559 explicitly asks for a real migration, not `db:push`.
- **API:** tRPC routers under `apps/web/src/server/routers/` (analytics is split into `routers/analytics/procedures/*.ts`). Anonymous student writes use Next route handlers under `apps/web/src/app/api/**/shared/route.ts`.
- **UI:** shadcn/ui (`components/ui/*`), Tailwind, Recharts 3.10 for charts, sonner for toasts.
- **Rate limits:** Upstash limiters in `apps/web/src/server/rate-limit.ts` (e.g. `publicStudyResponseRateLimit` at :106).
- **Commits / PR titles:** Conventional commits with a scope, e.g. `feat(analytics): …`, `feat(files): …`, `feat(web): …`. The issues each suggest a title.

---

## #559 — Students rate AI responses; professors see ratings

**Load-bearing assumption:** students will rate often enough that per-chatbot "% helpful" means something. Low participation, or ratings only on bad answers, would make the analytics card misleading. Check the rating rate per assistant message 2–4 weeks after launch, before investing in v2 (the "What went wrong?" pop-up). Other things that also affect whether professors improve their bots: low-confidence queries (already shipped) and reading transcripts (already shipped).

### Requirements (from the issue, scope agreed Nov 2026)

- Thumbs up/down on every **completed** assistant response, next to Copy. Clicking the same thumb clears the rating; clicking the other switches it. No buttons while streaming, or on interrupted or empty turns. Tooltip: "Your ratings and feedback are anonymous."
- Only in the shared link (`/chat/[shareToken]`) and the embed (`/embed/[shareToken]/window`), **never** in the professor's Chat tab.
- Professor side: each rated message shows its rating in Student Chats. The conversation list shows per-chat totals and has a "has a thumbs down" filter. The Analytics card shows % helpful, total ratings and a daily trend "using the existing date range". Export includes ratings.
- New table `message_ratings` (message_id UNIQUE → messages, conversation_id, chatbot_id denormalized, `rating smallint ±1`, timestamps, index `(chatbot_id, created_at)`), with a migration. Leave room for a nullable `comment` in v2.
- `POST /api/message-rating/shared` `{shareToken, sessionId, messageId, rating: 1|-1|null}` checks the share token → conversation by `(chatbotId, sessionId)` → the message belongs to that conversation and has `role='assistant'`, otherwise 404. It is rate-limited per (shareToken, IP), fail-open.
- The streamed message id must equal the persisted `messages.id`, with a test proving it.
- Privacy wording goes in three places: `app/privacy-policy/page.tsx`, `apps/docs/docs/instructors/review-conversations.mdx`, and `apps/docs/docs/students/` (the folder exists with `index.mdx`, `understanding-answers.mdx`, `quizzes.mdx`, `asking-good-questions.mdx`).
- Acceptance criteria also include `check-types`, `lint` and `test` passing.

### Code it touches (evidence)

| Concern                                               | Location                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stream assembly (where to set the message id)         | `apps/web/src/server/chat/stream-chat.ts:241-242` (`createUIMessageStream<StudyUIMessage>({ originalMessages … })`). The installed AI SDK accepts a `generateId` option here (checked earlier this session against `ai` 6.0.283)                                                                                                 |
| Assistant row insert (currently `defaultRandom()` id) | `apps/web/src/server/chat/turn-persistence.ts:137-139` (`insert(messages).values({ role: "assistant", … })`). There is a second `insert(messages)` at `:38`; its role was not classified. Every assistant-persist path, including the failed-turn and cut-off-turn recovery paths, must use the pre-generated id                 |
| History → UI id                                       | `apps/web/src/lib/chat/ui-messages.ts:42-52` (`rowToUIMessage` → `id: row.id`)                                                                                                                                                                                                                                                   |
| Analytics event per turn                              | `server/chat/turn-persistence.ts:66`, `app/api/chat/shared/route.ts:73` (`shared_message_sent`)                                                                                                                                                                                                                                  |
| Message UI (Copy button lives here)                   | `components/chat/messages/ChatMessage.tsx:107` and `:221` (`CopyButton`)                                                                                                                                                                                                                                                         |
| Shared surfaces that need the gate                    | `app/chat/[shareToken]/page.tsx:81`, `app/embed/[shareToken]/window/page.tsx:74`. The professor's Chat tab also renders `ChatInterface` at `app/chatbot/[id]/chatbot-detail-tabs.tsx:83`, so a `showRatings` prop (or a check on `shareToken` being present) is required                                                         |
| Shared chat hook                                      | `hooks/useChat.ts:18-22`: **a fresh `sessionId` (nanoid) per page load; no history rehydration**                                                                                                                                                                                                                                 |
| Pattern to copy (anonymous write)                     | `app/api/study-response/shared/route.ts:23-35` (POST plus `publicStudyResponseRateLimit`), `server/study/request.ts:47` (`findToolPartByToolCallId`), `:111` and `:148-156` (conversation-scoped lookups)                                                                                                                        |
| Client retry pattern                                  | `lib/submit-study-response.ts`: bounded retry on 404/5xx because the student can act before `onFinish` commits the row. Ratings have the **same race**: the buttons appear when the stream ends, which can be before the assistant row exists                                                                                    |
| Schema                                                | `packages/db/src/schema.ts`: `conversations` :306 (`sessionId` unique :313), `messages` :332, `studyToolResponses` :399 (the closest table pattern), `analytics` :432                                                                                                                                                            |
| Professor reads                                       | `server/routers/analytics/procedures/conversations.ts`: list :20, detail :96 (already loads study responses at :147-155, so ratings fit next to them), search :166. Export: `procedures/export-conversations.ts:29` (study responses :121-129), plus builders in `lib/export-conversations/{build-csv,build-html,build-text}.ts` |
| Analytics card                                        | New procedure in `server/routers/analytics/procedures/` registered in `routers/analytics/index.ts:16-30`. UI in `components/chatbot/AnalyticsTab.tsx` alongside `analytics-tab/*` cards                                                                                                                                          |

### Data-model change

One new table, `message_ratings`, as specified, generated as migration `0021_*`. No change to existing tables. `chatbot_id` is denormalized so analytics avoids joining through `messages`. The issue sets the cascade rules: deleting a conversation (`deleteConversationsProcedure`, conversations.ts:261) cascades to its ratings.

### External services

None new. Reuse Upstash for the rate limiter. No AI or email involved.

### Spec gaps needing an owner decision

1. **"Ratings persist across reloads" doesn't match how shared chat works.** `useChat.ts:18-22` starts a new session and an empty conversation on every page load. After a reload the student never sees their earlier messages again, so there is nothing to show a rating on. The issue's "persist locally until the history refetch returns it" assumes a refetch that doesn't exist. Options:
   - (a) Read the criterion as "persisted server-side and visible to the professor". Cheapest, and needs no new client state.
   - (b) Add session rehydration to shared chat. This changes conversation semantics and the session-count analytics, and is a separate feature.

   **Recommendation: (a).** It would be overturned if the owner wants students to resume conversations, which would be a separate issue.

2. **"The existing date range" doesn't exist.** `AnalyticsTab.tsx:33-66` hard-codes `timeRange: "month"` for message volume and sessions. Stats, session metrics and common questions are all-time (no range input; `insights.ts:10-16`, `usage.ts:16`, `sessions.ts:18`). Options:
   - (a) The rating card uses a fixed 30 days to match the charts.
   - (b) Add a tab-wide range picker. This changes every card and grows the PR.

   **Recommendation: (a)**, with the range picker as a separate issue.

3. **Who builds it.** @gum1x is assigned and said they're working on it (8 Nov). Their open PR #560 (i18n, +13,311/−2,245, 100 files) rewrites `ChatMessage.tsx`, `ChatInterface.tsx`, `chatbot-detail-tabs.tsx` and the analytics formatters. Work by anyone else on #559 will conflict with #560 and duplicate theirs. The owner should decide whether Obvious implements it, reviews gum1x's work, or waits. #560 merging first would also mean the new strings need i18n keys.
4. (Minor) The privacy wording says "collected anonymously". Rating rows carry no identity, but they link to a conversation whose `metadata` stores `userAgent` and `referrer` (schema.ts:313-318), and rate limiting keys on IP. The wording is accurate for identity. Flagging only so the owner is aware.

### Tests that would prove it

- `__tests__/server/chat/turn-persistence.test.ts` / `stream-chat-turn.test.ts`: the streamed message id equals the inserted `messages.id`, including the cut-off and failed-turn paths (`cut-off-turn.test.ts`, `failed-turn.test.ts`).
- A new `__tests__/server/rating/request.test.ts`, modelled on `__tests__/server/study/request.test.ts`: Zod rejection, unknown or disabled share token → 404, message from another conversation → 404, user-role message → 404, upsert/switch/clear, rate-limit fail-open.
- Export: extend `__tests__/lib/export-conversations.test.ts` with the rating column.
- Analytics: a pure helper for % helpful and the daily buckets, alongside `__tests__/server/analytics-helpers.test.ts`.
- UI gate: `ChatInterface` with no `shareToken` renders no thumbs. Visual evidence would be needed: shared chat, embed and the Student Chats detail.

### Size

3 PRs:

1. Id alignment, table and migration, shared route, and student buttons.
2. Professor detail and list counts, thumbs-down filter, export.
3. Analytics card and the privacy copy in 3 places.

PRs 2 and 3 can run in parallel once PR 1 lands.

---

## #315 — Semantic grouping for Common Questions

### Requirements

Pick a "rung" based on how fragmented the real data is: 1 normalization, 2 pg_trgm, 3 LLM batch canonicalization, 4 embeddings plus canonical matching. Similar openers must group under one representative with a combined count. Non-trivial grouping runs async, outside the request path. The query must stay a cheap `GROUP BY`. Thresholds and normalization must be tunable and documented. The issue itself recommends rung 1 next.

### Code (evidence)

- Current grouping: `server/routers/analytics/procedures/insights.ts:9-77`. It takes the first user message per conversation with `row_number()` (:27-29), groups on `lower(trim(content))` (:24-26, :56), is paginated (:13-14, :63-68), and is **all-time** (no date filter).
- UI: `components/chatbot/analytics-tab/common-questions-card.tsx` (107 lines), wired in `AnalyticsTab.tsx:55-62` and `:160`.
- Paths in the issue are out of date: it cites `routers/analytics.ts` and `analytics-tab.tsx`. Both have since been split into `routers/analytics/procedures/*` and `components/chatbot/analytics-tab/*`.
- Infrastructure that already exists:
  - `pg_trgm` and a GIN trigram index on `messages.content` (`packages/db/drizzle/0013_messages_content_trgm.sql`; schema.ts messages index). Supports rung 2.
  - The embedding client `packages/ai/src/openrouter-client.ts` (the file exists; the `generateEmbedding`/`text-embedding-3-small` details come from the issue text). Supports rung 4.
  - pgvector on `file_chunks` (schema.ts:271). Supports rung 4.
  - QStash client `apps/web/src/server/qstash.ts` for async jobs. Supports rungs 3 and 4.
  - Whether a scheduler (Vercel cron) is configured was not determined; the check timed out **(unverified)**. Rungs 3 and 4 need either a cron or an embed-on-write trigger from the chat persist path.

### Data-model change by rung

- 1: none. A pure TS/SQL normalizer.
- 2: none, or a trigram index on a normalized expression.
- 3: a new `question_clusters` table (chatbot_id, canonical label) plus a cluster id per conversation opener.
- 4: as rung 3, plus a `vector(1536)` column (either on a new `question_embeddings` table or on `messages`), a backfill, and an HNSW index.

### Product decision

**Which rung.** Recommendation: **rung 1 now** (1 small PR, no infrastructure, no cost). Measure what share of grouped questions still have count = 1 on a real chatbot, then decide on rung 3 or 4. This would be overturned if the owner already knows professors expect paraphrases like "Explain X" / "What is X" to merge; rung 1 can't do that. Rung 1 risks merging distinct questions, so it should be conservative and keep the original `MIN(question)` as the label shown.

### Tests

A pure `normalizeQuestion()` table test (e.g. "What is photosynthesis?" / "photosynthesis" / "whats photosynthesis" → same key; "photosynthesis in C4 plants" → different key), placed beside `__tests__/server/analytics-helpers.test.ts`. Rungs 3 and 4 also need job idempotency tests and threshold fixtures.

### Overlap

Same procedure file and card as #131's shipped work. If #559 adds a tab-wide date range, `getCommonQuestions` should accept it too. There are no open PRs touching `insights.ts`.

---

## #131 — Session-level insights: every acceptance criterion is met

Each criterion, checked against `main`:

| Acceptance criterion                                                           | Evidence on `main`                                                                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `ragUsagePercentage` computed, not hard-coded 0                                | `procedures/usage.ts:37-60` (ragHits / ragEventCount)                                       |
| Avg msgs/session, avg duration, RAG hit rate, unique sessions on the dashboard | `AnalyticsTab.tsx:109-140` (four `MetricCard`s) via `procedures/sessions.ts:17`             |
| Sessions-over-time chart next to the messages chart                            | `sessions.ts:60`; `AnalyticsTab.tsx:142-157` (`SessionsOverTimeCard`, `SessionLengthsCard`) |
| Common questions section                                                       | `insights.ts:9-77`; `AnalyticsTab.tsx:160`                                                  |
| Low-confidence (no-RAG) queries                                                | `insights.ts:79-132` (`ragUsed = 'false'`); `low-confidence-card.tsx`                       |
| Ownership checks; Zod and pagination                                           | `assertOwnedChatbot` in every procedure; `limit`/`offset` inputs                            |
| Recharts                                                                       | `analytics-tab/charts.tsx`; `recharts ^3.10.1`                                              |
| Event fields `ragSimilarityScore` and `sourcesCount` (optional)                | Typed in `schema.ts` `analytics.eventData` (:432 block)                                     |

These shipped in merged PR #305 (gum1x, 8 Jun 2026) and fix PR #317 (owner, 8 Jun). The only gap the issue names that isn't covered is "a way to gauge if the chatbot's answers are helpful", which is #559. `check-types` and `lint` were not run in this read-only pass.

**Owner decision:** close #131 as done, pointing to #305/#317, with #559 covering response quality and #315 covering grouping. 0 PRs.

---

## #137 — Newsletter signup and sending

### Requirements

- A signup form on the homepage (email, optional name) backed by a public tRPC `subscribe` procedure that calls Resend Contacts.
- An admin "Newsletter" area: subscriber list and count from Resend, compose, preview, send via Broadcasts, and optional history.
- A `Newsletter.tsx` React Email template that includes `{{{RESEND_UNSUBSCRIBE_URL}}}`.
- `RESEND_AUDIENCE_ID` added to env validation.
- No custom subscriber table and no custom unsubscribe page.

### Code and infrastructure (evidence)

- Resend SDK is **already installed**: `apps/web/package.json` has `"resend": "^6.28.0"` and `@react-email/render`. Env vars `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET` and `RESEND_SEGMENT_ID` are at `lib/env.ts:30-33`.
- **Resend renamed Audiences to Segments.** The installed SDK's types (`resend/dist/index.d.mts`) expose `segments`, `broadcasts` and `contacts`. `audiences` remains only as an alias of `Segments` (:2727-2732), and `audienceId` is marked `@deprecated Use segmentId instead` (:743, :940). The issue's `RESEND_AUDIENCE_ID` and `audiences.create` sample code should become `RESEND_*_SEGMENT_ID` and `segmentId`.
- **A segment sync already exists.** `server/resend-segment.ts:43` (`syncUserToResendSegment`) adds every **approved user** to `RESEND_SEGMENT_ID` using raw `fetch` to `api.resend.com` (:17-34). It deliberately never overwrites an opted-out contact's `unsubscribed` flag (comment :26-41). It is called from `server/auth/user-admin.ts:35`. The issue's "contacts.create … re-adding updates it" approach would **re-subscribe people who opted out**, which is exactly the bug that file avoids. Reuse its add-to-segment-then-create-on-404 logic for signup.
- Transactional email: `server/email/delivery.ts:19` (`queueEmail`, sender `Teach Anything® <…>` at :67) and templates in `components/emails/*.tsx` (9 templates).
- Homepage: `app/page.tsx` composes 12 `components/landing/*` sections. A signup section would sit before `Footer`.
- Admin: `app/(admin)/admin/page.tsx:129-167` has four shadcn `Tabs` (users, all-users, chatbots, domains). A Newsletter tab would follow that pattern, under `adminActionRateLimit` (rate-limit.ts:120).
- Public signup needs a new limiter, since none of the existing ones fit. It also needs bot protection (honeypot or similar): an unauthenticated endpoint that writes to the mailing list is an abuse vector.

### Data model

None. Resend holds the contacts, as the issue specifies.

### External services and keys

Resend is already configured. Actually sending broadcasts additionally needs a newsletter segment id and a verified sending domain in the Resend dashboard (domain status was not checked). No QStash or cron is needed, because Resend throttles broadcasts.

### Product decisions (blocking)

1. **Go / no-go.** PR #282 (AkmalHakimov) was closed on 7 Jul 2026. My earlier reading of that thread this session recorded the owner saying a custom dashboard workflow duplicated what Resend already offers and that the feature should wait for product validation. The issue is still assigned to @AkmalHakimov (since 22 Apr). The owner should either confirm that a reduced scope is wanted, or close the issue or mark it as on hold.
2. **Which segment.** Options:
   - Reuse `RESEND_SEGMENT_ID`, which holds approved professors. Visitor signups would then mix with users.
   - Create a separate newsletter segment, whose contacts are visitors who opted in.

   Consent rules differ between the two (approved users never explicitly opted in to a newsletter).

3. **Admin compose UI vs. the Resend dashboard.** Broadcasts can be written and sent from Resend's own UI. If the owner's concern in #282 still stands, ship only the homepage signup (1 PR) and send from Resend.

### Tests

- Signup: Zod email validation; contact already in the segment → no re-subscribe; 404 → create; `RESEND_API_KEY` missing → graceful no-op. Model on `__tests__/lib/resend-segment.test.ts`.
- Admin router: admin-only guard.
- Template: render it and assert the unsubscribe placeholder is present.

### Size

1 PR (signup only) or 2 PRs (signup, then the admin broadcast tab). Overlap with open PR #340 (admin registration emails; CONFLICTING with CHANGES_REQUESTED): both touch `server/routers/admin.ts` and `components/emails/`.

---

## #128 — RTF file support (good first issue)

### Requirements

- Accept `.rtf` as `application/rtf`, with `text/rtf` as an alias.
- Extract plain text with formatting stripped, using `sanitizeText`.
- Throw a descriptive error when the file is empty.
- Text flows through chunking, embedding and storage.
- Unit tests for normal RTF, formatted RTF and empty RTF.

### Code (evidence): the issue's paths are out of date

- Allowed types: `apps/web/src/server/routers/files/validation.ts:7-16` (`SUPPORTED_FILE_TYPES`), `:21-35` (`EXTENSION_MIME_MAP`), `:40-51` (display names).
- The same lists are duplicated on the client: `components/dashboard/files/file-constants.ts:10-30` (`ALLOWED_FILE_TYPES`, `ALLOWED_EXTENSIONS`) and the display names after them. The `accept=` attribute is hard-coded at `UploadFileDialog.tsx:97`. All three places must change.
- Magic-byte check: `packages/ai/src/file-signature.ts:35-40` (`SIGNATURES`) and `:50-55` (`TEXT_MIMES`). RTF needs an entry for `{\rtf` (0x7B 0x5C 0x72 0x74 0x66), taken from the RTF spec (training knowledge, not checked against a sample file). This matters because `parseOffice` sniffs the type on its own (the comment at :9-15).
- Extraction switch: `packages/ai/src/rag-service.ts:90-111`. Add a `case` for `application/rtf` and `text/rtf`. The issue cites `apps/web/src/lib/file-processor.ts`, which doesn't exist. The pipeline is `server/file-processor/pipeline.ts:117-124`, which calls `ragService.extractAndChunk(buffer, file.fileType)`.
- Library: **`officeparser` 6.1.0 is already a dependency**, and its bundled README lists `rtf` among supported formats. `extractPowerPoint` (rag-service.ts:238-306) already uses `parseOffice` and walks the AST, so an `extractRtf` can reuse that traversal. Whether the RTF AST has the same node shape was not tested **(unverified)**. This avoids the new dependency that the closed PRs #147 and #163 kept running into.
- Server test that changes: `__tests__/server/files-validation.test.ts:55` asserts `toHaveLength(8)`.

### Data model and infrastructure

None.

### Tests

Fixture-based `packages/ai/src/__tests__/extract-rtf.test.ts`, mirroring `extract-powerpoint.test.ts`: plain text, bold/italic/fonts stripped, Unicode escapes (`\u…`), empty file → error. Also new cases in `file-signature.test.ts` (an RTF header passes; PDF bytes claiming to be RTF are rejected) and `files-validation.test.ts`.

### Open PRs touching it

- **#561** (OCR) and **#550** (vision) both modify `validation.ts`, `file-constants.ts`, `UploadFileDialog.tsx`, `file-signature.ts`, `rag-service.ts`, `files-validation.test.ts` and `file-signature.test.ts`. Both are mergeable today; whichever lands second gets conflicts. Land #128 after them, or rebase onto them; the changes are additive list edits, so conflicts would be mechanical.
- **#560** (i18n) also edits `file-constants` tests.

### History

#147 and #163 (Dhwanil25) were closed unmerged. #163 was closed for inactivity after review asked for a maintained parser and tests, and asked that unrelated changes be removed. The issue is currently unassigned.

### Size

1 small PR. No product decision is needed.

---

## Cross-issue overlap and order

- **Analytics cluster:** #131 is done. #559's card and #315's grouping are both new procedures in `routers/analytics/procedures/` plus cards in `AnalyticsTab.tsx`. A tab-wide date range, if the owner wants one, should be its own PR before both, because it would change every card.
- **#559 feeds analytics:** ratings provide the "response quality signal" #131 named. A later idea outside v1 is to join thumbs-down to low-confidence queries.
- **Chat UI contention:** #559 vs. open PR #560 (`ChatMessage.tsx`, `ChatInterface.tsx`, `chatbot-detail-tabs.tsx`), both by gum1x.
- **File pipeline contention:** #128 vs. open PRs #561 and #550 (7 shared files).
- **Migrations:** only #559 needs one here (`0021_*`). Open PR #340 carries `0019_true_mole_man.sql`, which collides with `main`'s `0019_wise_killraven.sql`; that is its problem to fix, not these issues'. Whichever schema PR merges first takes the next migration number.
- **Suggested order:** #128 (after #561/#550) and #315 rung 1 can go anytime. #559 waits on the owner's decision about who builds it and on #560. #137 waits on go/no-go. Close #131.

## Decisions requested from the owner

1. #559: accept "persist across reloads" = server-side persistence, with no session rehydration (recommended).
2. #559: use a fixed 30-day window for the rating card (recommended), or build a tab-wide date-range picker first.
3. #559: who implements it, given @gum1x's claim and their open #560.
4. #315: which rung. Rung 1 is recommended, then measure.
5. #131: confirm closing it as complete.
6. #137: go/no-go after the #282 postponement. If go, choose a separate newsletter segment or the existing approved-user segment, and say whether an admin compose UI is wanted at all.

## Verification limits

- No lint, typecheck, tests or migrations were run; this was read-only research.
- Not tested: whether `officeparser` produces RTF output, the RTF magic bytes against a real file, the Vercel cron config (that check timed out), and Resend domain verification.
- The note on PR #282's closing reason comes from my earlier reading of that thread this session; the quote was not re-read for this document.
