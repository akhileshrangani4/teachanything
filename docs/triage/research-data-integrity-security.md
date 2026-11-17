> Research document: teachanything data-integrity & security bugs.
> Exported from the Obvious project _Teachanything Issue Triage_ on 2026-11-17. Source: `art_z6LepG9f`.

# Research — teachanything data-integrity & security bugs

Issues #462, #463, #464, #465, #480 on `akhileshrangani4/teachanything`, read against `origin/main` at `ad356f3` (release 1.37.0). Line numbers point at that commit. This was read-only research: no code changed and no branch pushed.

## Summary

| Issue                                                                | Still on main?                                                                      | Minimal fix                                                                          | Migration?                             | Size                           | Ships independently?                                     |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------- | ------------------------------ | -------------------------------------------------------- |
| #462 duplicate job wipes a completed file                            | **Yes.** Open PR #550 already rewrites this path                                    | Land #550 (atomic swap + version skip), then a small follow-up for what's left       | No                                     | S follow-up, or M without #550 | **No.** Same files as #550 and #463                      |
| #463 failed publish strands a row; retry deletes its object          | **Destructive half already fixed** (#533, #534). The stranded `pending` row remains | Mark the row retryable when publish fails (no outbox)                                | No (interim) / Yes (outbox)            | S / M–L                        | After #550 (shared files)                                |
| #464 storage deleted before DB tx; failures swallowed                | **Yes**, plus 3 sibling defects                                                     | Fail closed: batched, verified storage delete, and abort before the DB tx on failure | No (fail-closed) / Yes (tombstones)    | S / M                          | Yes                                                      |
| #465 concurrent turns share a history snapshot, persist out of order | **Yes.** Narrower impact than the issue says                                        | Compare-and-set "turn in flight" claim on the conversation                           | No (jsonb marker) / Yes (`turn_index`) | M                              | Mostly. Chat routes overlap PR #560                      |
| #480 `checkUserStatus` account-enumeration oracle                    | **Yes.** The issue's suggested fix still leaks                                      | Delete the procedure and the login fallback                                          | No                                     | S                              | Yes. Conflicts textually with PR #560 (`login/page.tsx`) |

**Decisions needed from a person before spec approval**

1. **#464:** Should a storage failure block account deletion (fail closed, user retries), or should deletion always go through and leave storage cleanup to a tombstone sweeper? The first needs no migration. The second needs a new table and a scheduled trigger.
2. **#465:** When a second turn arrives on a busy conversation, should it be rejected (409 "a response is already in progress") or wait? Waiting would mean holding a lock or polling inside a streaming request.
3. **#462:** Is PR #550 the vehicle for the core fix? It fixes most of #462 but does not reference it.
4. **#480:** Should the endpoint be removed outright (recommended), or reduced to the issue's `pending | rejected | null` shape? That shape still discloses pending and rejected accounts.

---

## Repo conventions (captured once)

- **Package manager:** npm workspaces (`packageManager: npm@11.4.2`, `package-lock.json`; a stray `bun.lock` also exists). Turborepo orchestrates the packages. Node `>=24`. Workspaces: `apps/web`, `apps/docs`, and `packages/{ai,db,logger,eslint-config,typescript-config}`.
- **Commands (root):** `npm run lint`, `npm run check-types`, `npm run test` (coverage: `npm run test -- -- --coverage`), `npm run format:check`, `npm run build`. Single package: `cd apps/web && npm test`. The web test script is `NODE_OPTIONS=--experimental-vm-modules jest`.
- **Tests:** Jest 30 + ts-jest, ESM. Globals must be imported from `@jest/globals`. External modules are mocked with `jest.mock(...)` and then the module under test is loaded with `await import(...)` (AGENTS.md §12). Tests live under `apps/web/src/__tests__/{lib,server,components,hooks}` and mirror the source tree. **There is no real-Postgres test harness** (no pglite, testcontainers or pg-mem in the repo). Transaction, lock and concurrency properties can only be asserted through mocked DB call sequences.
- **Pre-commit (Husky):** lint-staged runs prettier, then `check-types`, `lint` and `test` (AGENTS.md §14).
- **CI workflows (`.github/workflows`):**
  - `build.yml`: `npm ci` → `format:check` → `check-types` → `lint` → `build` (`SKIP_ENV_VALIDATION=1`)
  - `test.yml`: `npm run test -- -- --coverage`, then a Codecov upload (not failing CI)
  - `conventional-commits.yml`: job `validate-pr-title`. It is a required check in the `main` ruleset. Allowed types: feat, fix, perf, deps, revert, docs, style, chore, refactor, test, build, ci
  - `automation-labels.yml`: area/change labels; "Do Not Merge" fails while the `status: do not merge` label is set
  - `release-please.yml`: release-please on push to `main`. When a release is cut, `deploy-production` runs `npm run db:migrate` in `packages/db` against the prod `DATABASE_URL` secret, then merges `main` into the `production` branch
  - Also seen on PR #550's checks: CodeQL, GitGuardian, Vercel Preview Comments, codecov/patch
- **PR titles and commits:** conventional commits, `<type>(scope): <description>` (AGENTS.md §13). PR template sections: Summary / Changes / Library Choices / Screenshots / Test Plan / Checklist.
- **DB / ORM / migrations:** PostgreSQL + Drizzle ORM 0.45 + pgvector. Schema is in `packages/db/src/schema.ts`. Migrations are generated with `drizzle-kit generate` into `packages/db/drizzle/NNNN_*.sql` plus `meta/` snapshot and journal. The latest is `0020_user_files_user_id_idx` (journal idx 20). `db:migrate` = setup-extensions → `drizzle-kit migrate` → index health check. `drizzle.config.ts` loads `apps/web/.env`, which the issues state points at **production** Supabase, so dry-run any schema change on a scratch DB. AGENTS.md §15: no schema change without a migration plan, and no dependency changes unless asked.
  - Open PR #340 adds `0019_true_mole_man.sql`, which collides with the existing `0019_wise_killraven`. Any new migration from this work must be renumbered against whatever lands first.
- **Existing row-lock precedent:** `.for("update")` in `server/routers/crawler/procedures/remove-crawl-source.ts:28` and `remove-crawled-page.ts:39`. No advisory locks anywhere.
- **Sweeps are opportunistic, not scheduled:** `sweepStaleFiles` (`server/file-stale.ts:165`) runs on file-list reads (`files/procedures/list.ts:44, 188`). The orphaned-upload cleanup is a manual script (`packages/db/scripts/sweep-orphaned-uploads.ts`, report-only unless `--apply`). Any "sweeper retries later" design (outbox, tombstones) also needs a trigger: a QStash schedule, a cron, or piggybacking on a read path.

## Open PRs that touch these areas

| PR                                                 | Status                            | Overlap                                                                                                                                                                                                                                                                             |
| -------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#550** feat(files): visual material analysis     | Open, mergeable, all checks green | `file-processor/pipeline.ts`, `file-status.ts`, new `file-index-storage.ts`, `reprocess.ts`, `qstash.ts`, `api/jobs/process-file/route.ts`, `files/procedures/finalize-upload.ts`, `retry.ts`, `packages/db/src/schema.ts`. **Directly fixes most of #462**; shares files with #463 |
| **#560** feat(i18n): translate dashboard           | Open                              | `app/(auth)/login/page.tsx` (the #480 consumer), `app/api/chat/route.ts` and `api/chat/shared/route.ts` (#465 error surfacing)                                                                                                                                                      |
| **#340** feat(admin): registration email templates | Open                              | `schema.ts` and migration journal (numbering collision; see above)                                                                                                                                                                                                                  |
| #561, #558, #547                                   | Open                              | No overlap with these five issues' files except `rag-service.ts` (#561), which none of the fixes need                                                                                                                                                                               |

No open PR touches `services/user-deletion.ts`, `routers/auth/procedures/status.ts`, `chat/stream-chat.ts`, `chat/turn-context.ts` or `chat/turn-persistence.ts`.

---

## #462 — file-processor: a duplicate job can delete a completed file's chunks and downgrade it to failed

### 1. Still present on main? Yes.

- `apps/web/src/server/file-processor/pipeline.ts:49-68`: the claim flips any non-`processing` row to `processing` (`ne(userFiles.processingStatus, "processing")` at `:65`). It also **replaces the whole `metadata`** (`:53-60`), dropping `chunkCount` and `processingVersion` at the moment of the claim.
- `:78-80`: unconditional `db.delete(fileChunks)` right after the claim, before anything new exists.
- `:168-190`: insert and status update are two separate statements, with no transaction.
- `:201-229` (catch): deletes chunks again (`:207`), then writes `processingStatus: "failed"` with `metadata: { error }` (`:221-229`).
- `files/procedures/retry.ts:51-53` also deletes chunks before the new job runs.
- Duplicate deliveries happen. `qstash.ts:68` publishes with `retries: 3`; QStash delivery is at-least-once (training knowledge, not checked this session). The route returns 200 or 500 straight from `processFile` (`api/jobs/process-file/route.ts:67-82`).

### 2. Root cause

The pipeline is destructive-first. It removes the good index before the replacement exists, and on failure it removes it again and marks the file `failed`. On top of that, the claim cannot tell a redelivery of the same job from a deliberate reprocess. Excluding only `processing` is required, because `reprocess.ts:36-103` re-runs `completed` files and `file-stale.ts:107-117` depends on the guard to recover wedged files.

**Sibling defect, not in the issue:** retrieval reads only `completed` files (`server/rag-context.ts:79`, `server/hybrid-search.ts:127`). A _successful_ reprocess therefore still hides the file from RAG for the whole run, because the claim flips it to `processing`. The same gap exists in PR #550.

### 3. Fix shape

**PR #550 already implements the core of the issue's "staged chunk swap"**, read from its head:

- Version-target idempotency: `processFile({ targetProcessingVersion, force })` returns early when the row is `completed` and `processingVersion >= target`, unless `force` is set. A redelivered non-forced job becomes a no-op.
- `file-index-storage.ts` `replaceFileIndex`: delete old chunks, insert new ones and set `completed` in **one `db.transaction`**.
- The catch keeps a previously usable file `completed` and records `refreshWarning` / `refreshFailedAt` instead of `failed`. It no longer deletes chunks. `retry.ts` stops deleting chunks up front.
- `reprocess.ts` releases the `reprocessQueuedAt` claim when a publish fails.

**What remains after #550**, as a small follow-up:

- **A forced job can still be redelivered.** `retry` publishes `force: true`, so a QStash redelivery re-runs the whole pipeline (extra embedding and vision spend). The atomic swap means no data is lost. Fix options:
  - (a) **Recommended.** A run token in jsonb metadata (`metadata.processingRunId`), so no migration: the dispatcher mints it and puts it in the QStash body, and the claim becomes compare-and-set on it.
  - (b) The issue's `processing_run_id uuid` column. Same logic, but needs a migration.
- **RAG visibility during a refresh.** Options:
  - (a) **Recommended.** Keep `processingStatus = "completed"` during a refresh of a file that already has a usable index, and track progress in metadata. This changes what the Files UI shows as "processing" for refreshes.
  - (b) Let retrieval also accept `processing` rows that still hold a completed index (`metadata.chunkCount > 0`). This touches the hot retrieval query.

**If #550 does not land**, the minimum is the same shape lifted out of it: the transactional swap, no delete-before-success, preserve `completed` on failure, and the version skip. Size M, no migration.

### 4. Tests

- Existing near the code: `__tests__/server/reprocess.test.ts` (claim semantics), `process-file-route.test.ts` (only `maxDuration` and export), `files-storage-cleanup.test.ts`, `__tests__/lib/file-stale.test.ts`. **There is no direct unit test of `processFile` on main.** #550 adds `file-index-storage.test.ts`, `file-status.test.ts`, `retry.test.ts`, `reprocess-dev.test.ts` and others.
- Tests that would prove the fix, all with a mocked `@teachanything/db`:
  1. A completed file at the current version plus a non-forced job: no claim update, no `fileChunks` delete, and the function returns success.
  2. Embedding throws for a previously completed file: no `fileChunks` delete, status written as `completed` with `refreshWarning`, never `failed`.
  3. The chunk swap issues delete, insert and status update inside a single `transaction` callback.
  4. (Follow-up) Two deliveries with the same run id: the second is a no-op. A new run id claims normally.
  5. (Follow-up) A file under refresh still appears in `rag-context`'s file list.

### 5. Open PRs

**#550**: open, checks green. Its body does not mention #462.

### 6. Size and coupling

S as a follow-up on #550; M without it. Shares `pipeline.ts`, `qstash.ts`, `retry.ts`, `reprocess.ts` and `api/jobs/process-file/route.ts` with #550, and `finalize-upload.ts`, `retry.ts` and `qstash.ts` with #463. **Sequence after #550.**

---

## #463 — finalize-upload: a failed QStash publish leaves a row whose storage object the retry deletes

### 1. Still present on main? Partly. The destructive half is fixed.

The issue cites a duplicate-filename branch that called `cleanupFile(input.storagePath)` (`~line 122`). That code existed at `73fc52d` and was **replaced by #533 (`725bcd0`) and #534 (`8ed5d02`)**:

- `files/procedures/create-file-record.ts:74-75` (`findOwnRecord`, `:112-119`): each attempt first looks up the upload's **own** row (`id = fileId`, `userId`) and returns it if it exists. The duplicate-name check excludes its own id (`:84-85`).
- `finalize-upload.ts:147-152`: a repeated finalize republishes only when its own row is still `pending`. So a same-`fileId` retry **resumes** the stranded row, which was the issue's "cheaper interim" fix.
- `finalize-upload.ts:57-73, 196-205`: storage cleanup runs only when no row was created, and `removeUnclaimedUpload` refuses if the own row exists.
- Storage paths are per upload: `${userId}/${randomUUID()}` (`create-upload-url.ts:81-82`). The UI retry runs the whole flow again and gets a new `fileId` (`lib/direct-upload.ts:34-40, 89-95`). On a name conflict the cleanup deletes only the **new** upload's own object. This is covered by `files-storage-cleanup.test.ts:248` ("deletes the uploaded file when the name is already taken") and `:209` ("never deletes the file behind a row that already exists").

**What still reproduces on main:** `createFileRecord` commits the row (`finalize-upload.ts:136-145`) and the publish happens after (`:173-176`). If the publish throws, the row stays `pending` and the client gets a 500. When the user retries:

- `createUploadUrl` rejects the same file name with CONFLICT "already exists" (`create-upload-url.ts:67-75`), which is confusing.
- The stranded row sits at `pending` until `sweepStaleFiles` fails it after `STALE_PENDING_MS` = 60 min (`file-stale.ts:20`). Only then does the UI offer Retry.
- Nothing republishes automatically. **No storage object is lost.**

The same publish-after-commit shape appears in `retry.ts:70-107` (harmless, since `pending` stays retryable) and `reprocess.ts:61-98` (the claim expires after `REQUEUE_AFTER` = 1 h; #550 releases it on publish failure).

### 2. Root cause

A DB write and a QStash publish happen in two steps with no outbox and no compensating action. The row is committed as `pending`, a state that only the lost job would ever move forward.

### 3. Fix shape

- **(A) Recommended interim. No migration, size S.** In `finalize-upload.ts`, when `publishFileProcessingJob` throws, write the row to a retryable terminal state: `processingStatus: "failed"`, `metadata.error: "Couldn't queue processing — use Retry."`. Optionally retry the publish once before that. Then return or throw a typed error the UI can show. The Files tab immediately offers Retry, which republishes. Trade-off: a transient QStash blip shows the user a "failed" file instead of auto-healing.
- **(B) The issue's outbox.** A `pending_jobs` table written in the same transaction as the row, a best-effort publish after commit, and a sweeper republishing leftovers. This also covers `retry.ts` and `reprocess.ts`. Trade-off: a migration, plus a **scheduled trigger the repo does not have today** (sweeps run on list reads). Size M–L.
- (C) Opportunistic republish in `sweepStaleFiles` for `pending` rows past a short grace period, instead of failing them at 60 min. No migration, but it publishes jobs from a read path and needs the owner to open the page.

### 4. Tests

- Existing: `__tests__/server/files-storage-cleanup.test.ts` (`files.finalizeUpload` block, `:175-270`) and `create-file-record.test.ts`.
- New: (1) publish throws → the row is updated to `failed` with the queue-error message and no storage removal; (2) a repeat finalize for a `pending` own row republishes exactly once (existing behavior, worth pinning); (3) (B only) the outbox row is inserted in the same transaction as `user_files`.

### 5. Open PRs

**#550** edits `finalize-upload.ts` (adds validation and `targetProcessingVersion`), `retry.ts`, `reprocess.ts` and `qstash.ts`.

### 6. Size and coupling

(A) is S and needs no migration, but should land **after #550** to avoid conflicts. Shares `qstash.ts` and `retry.ts` with #462. Recommend retitling or narrowing the issue: the "retry deletes the storage object" claim no longer holds on main.

---

## #464 — user-deletion: storage is deleted before the DB transaction, so a failure orphans PII

### 1. Still present on main? Yes, plus siblings.

`apps/web/src/server/services/user-deletion.ts`:

- `:40-43` selects **every** `userFiles.storagePath` for the user, including crawled-page rows whose `storagePath` is a URL. It does not apply `excludeCrawledPages` (`server/crawled-page-files.ts:41`; `isCrawledPagePath` at `:29`).
- `:45`: the storage step runs only when Supabase storage is configured. **Local-storage mode deletes nothing** (`deleteLocalFile` exists in `server/local-storage.ts:45`).
- `:51-53`: one unbatched `remove(storagePaths)`. The repo's own orphan sweep batches at `REMOVE_BATCH_SIZE = 100` (`packages/db/src/orphaned-uploads.ts:21`).
- `:55-59`: a storage error is logged and execution **continues**.
- It does not check the "success with nothing removed" case. `files.delete` documents that this happens when the key lacks delete rights and guards it with an `exists` check (`files/procedures/delete.ts:54-63`).
- `:69-83`: the DB transaction runs afterwards and the cascade removes the rows, so nothing in-app references the leftover objects.
- Callers: `routers/auth/procedures/delete-account.ts:87` (self-service) and `routers/admin/procedures/user-status.ts:211` (admin).

Mitigation that already exists: the manual `db:sweep-orphaned-uploads` script finds objects with no `user_files` row (`ORPHANED_UPLOADS_QUERY`). Leftovers _can_ be enumerated, contrary to the issue, but only when someone runs the script with `--apply`.

### 2. Root cause

A cross-system delete runs in the wrong order with a swallowed error. Storage failure is treated as non-fatal, the row that is the only in-app pointer to the object is deleted anyway, and the result is reported as success. `files.delete` already adopted the opposite rule ("Stop before touching the database", `delete.ts:48`); account deletion never got it.

### 3. Fix shape

- **(A) Recommended minimal. Fail closed, no migration, size S.** Mirror `files.delete`:
  1. Collect upload paths only, using `excludeCrawledPages` or `isCrawledPagePath`.
  2. Delete them in batches of `REMOVE_BATCH_SIZE`.
  3. Verify each batch. If `removed.length` is short, confirm with `exists`.
  4. Add the local-storage branch.
  5. **Throw before the DB transaction** on any failure.

  A retry re-enumerates from the still-intact rows, and removing an already-removed object is harmless. If the DB transaction fails after storage succeeded, rows briefly point at missing objects until the user or admin retries, and the retry completes. Trade-off: **a storage outage blocks account deletion** until it recovers, and both the user and the admin see an error.

- **(B) The issue's tombstone design. Migration, size M.** In one transaction, insert paths into `deleted_storage_objects` and delete the user. Then try storage deletion and drop the tombstones that succeed. A sweeper retries the rest. Deletion always "succeeds" and leaves an audit trail. Trade-off: new table, a scheduled trigger the repo lacks, and the tombstone table keeps storage paths (`{userId}/{fileId}`, not PII itself) after the user is gone.
- (A) can ship now and (B) can replace it later. The choice is **decision 1** above.

### 4. Tests

- Existing: `__tests__/server/user-deletion.test.ts` (11 cases). **`:170` "continues deletion even if Supabase storage cleanup fails" encodes the bug and must be inverted.** Also related: `files-storage-cleanup.test.ts` `files.delete` block (`:125-173`) as the pattern to copy.
- New:
  1. A storage error leads to a throw, and `db.transaction` is never called.
  2. "Removed nothing but object still exists" also throws.
  3. Crawled-page URLs are never passed to `remove`.
  4. More than 100 paths produce multiple `remove` calls.
  5. Local mode calls `deleteLocalFile` per path.
  6. On success, storage deletion happens before the transaction.

### 5. Open PRs

None touch `user-deletion.ts` or its callers.

### 6. Size and coupling

(A) S and fully independent. (B) M, with a migration that must be numbered after #340/#550 land.

---

## #465 — chat: concurrent turns on one session share a history snapshot and can persist out of order

### 1. Still present on main? Yes. The visible impact is narrower than described.

- `server/chat/stream-chat.ts:86-90` `resolveConversation` (`chat/conversation-resolution.ts:13-60`) is get-or-create with `onConflictDoNothing`. It takes no lock and has no turn identity.
- `stream-chat.ts:119-129` → `chat/turn-context.ts:45-51`: history is read (`orderBy(desc(messages.createdAt)).limit(50)`) **before** the user row exists.
- `stream-chat.ts:217-222`: `beginUserMessageInsert` (`chat/turn-persistence.ts:23-53`) starts only after the snapshot. The assistant row is inserted in `onFinish` (`turn-persistence.ts:124-153`), whenever generation ends.
- `messages` has no sequence column (`packages/db/src/schema.ts:332-…`; `createdAt` default `now()`). Every reader orders by `created_at`: `turn-context.ts:50`, `routers/analytics/procedures/conversations.ts:137` (professor transcript), and `export-conversations.ts:115` (tie-break on random `uuid` id, which means nothing).
- Interleaving: user A, user B, assistant B (fast), assistant A (slow). B's model call never sees A's question.

**Impact is narrower than the issue says.** The student client mints a fresh `sessionId` per page load (`hooks/useChat.ts:18-22`) and never rehydrates the transcript, so two tabs means two sessions. It also blocks sending while `status` is `submitted` or `streaming` (`useChat.ts:59`). Realistic triggers are a double-submit before the status flips, network retries, and direct API callers of `/api/chat` or `/api/chat/shared` (the session id is client-supplied, `api/chat/route.ts:60`, `shared/route.ts:71`). The corrupted transcript shows up in the **professor's Conversations view and CSV export**, not in the student's UI.

### 2. Root cause

Each turn takes its snapshot before it claims a place in the conversation, and nothing serializes turns per conversation. Row order is inferred from insert timestamps that are written at different points in the turn's lifetime.

### 3. Fix shape

- **(A) Recommended. Compare-and-set in-flight claim, no migration, size M.**

  ```sql
  UPDATE conversations
  SET metadata = metadata || {activeTurnAt: now()}
  WHERE id = $1
    AND (metadata->>'activeTurnAt' IS NULL
         OR (metadata->>'activeTurnAt')::timestamptz < now() - interval '300 seconds')
  RETURNING id
  ```

  If no row comes back, throw `ChatRequestError("A response is already in progress", 409)`. That type already exists, used at `conversation-resolution.ts:54`. Clear the marker in `onFinish` on every path (success, abort, timeout, error). The 300 s expiry matches `maxDuration`, and `STREAM_TIMEOUT_MS` is 290 s (`stream-chat.ts:40`), so a killed function cannot wedge a conversation. Only one turn runs per conversation, which fixes both the shared snapshot and the ordering. No lock is held across generation.

  Trade-offs: a legitimate fast double-send gets a 409 the client must show (`useChat.ts` and the i18n'd error mapping touched by #560). A function killed without `onFinish` locks the session for up to 5 minutes.

- **(B)** A `SELECT … FOR UPDATE` on the conversation row (repo precedent: `.for("update")`) or `pg_advisory_xact_lock`, held across user insert plus history read. The second turn waits and then sees A's _question_, but not A's answer if A is still streaming. Assistant ordering is still wrong, so this alone fixes only half the problem.
- **(C) Durable ordering:** a `turn_index` on `messages`, or `metadata.replyToMessageId` on assistant rows (jsonb, no migration), with readers ordering by turn. This makes transcripts correct even under retries, but changes three readers. With `turn_index` it also needs a migration plus a backfill. A follow-up if (A) is not enough.
- Related and out of scope: a per-turn idempotency key so client retries don't create a second turn.

### 4. Tests

- Existing: `__tests__/server/chat/*` (18 files, including `stream-chat-turn.test.ts`, `turn-persistence.test.ts` with a `fakeDatabase`, `turn-context.test.ts`, `request.test.ts`). There is no test for `resolveConversation`.
- New:
  1. A claim when the marker is null or expired succeeds; a claim during a live turn yields a 409 `ChatRequestError` and no user-message insert.
  2. The marker is cleared after success, client abort, timeout and an `execute` error (`turn-persistence.ts` and `turn-execution.ts` paths).
  3. Route handlers map the 409 to a response the client shows.
  4. (C) Transcript readers order by turn, not `created_at`.

### 5. Open PRs

**#560** edits `app/api/chat/route.ts` and `app/api/chat/shared/route.ts` (error-message i18n), plus `components/chat/messages/ChatInterface.tsx`. Expect conflicts if the 409 is surfaced there. Nothing touches `stream-chat.ts`, `turn-context.ts` or `turn-persistence.ts`.

### 6. Size and coupling

M for (A). Server logic is independent; client and route messaging overlap #560. Separate from the other four issues.

---

## #480 — auth: checkUserStatus is an unauthenticated account-enumeration oracle, only throttled

### 1. Still present on main? Yes.

- `routers/auth/procedures/status.ts:42-73`: a `publicProcedure` taking an email and returning `{ exists: false, status: null }` (`:66`) or `{ exists: true, status }` (`:69-72`). Exposed as `auth.checkUserStatus` (`routers/auth/index.ts:13`).
- Throttle: `userStatusProbeRateLimit`, 10/min (`server/rate-limit.ts:191-194`), checked with `failOpen = false` (`status.ts:46-51`). But `checkRateLimit` **allows when no limiter is configured** (`rate-limit.ts:229-231`), so a Redis-less deploy is unthrottled. The comment at `rate-limit.ts:189-190` ("fail closed") overstates this; the docblock at `status.ts:33-41` is accurate. The key comes from `getTrustedClientIp`, which falls back to the shared bucket `"unknown"` (`lib/get-client-ip.ts:39`).
- The only consumer is `app/(auth)/login/page.tsx:83-106`, reached only when sign-in fails with an error that does not contain "credentials".
- There is no test of the procedure (grep of `__tests__` found none).

### 2. Root cause

A login-UX helper returns the raw `user.status` lookup to anonymous callers.

**The issue's suggested fix is not enough.** Returning `pending | rejected | null` still tells an anonymous caller that a given email _is registered and awaiting approval_ or _was rejected_, which is enumeration of exactly the accounts an attacker cannot otherwise confirm.

**The fallback is redundant.** `server/auth/session-gate.ts:42-60` throws `ACCOUNT_PENDING` / `ACCOUNT_REJECTED` from the session-create hook, and `login/page.tsx:66-80` already redirects on those codes. The gate runs at session creation, which in Better Auth's email sign-in happens after the password is verified (training knowledge; confirm with a test). Only callers who know the password learn the status. The fallback adds value only when the gate itself errors (`session-gate.ts:78-82` returns `false` on a DB failure) or on rate-limit or network errors. Those are cases where a status lookup would likely fail too.

### 3. Fix shape

- **(A) Recommended. Remove it, size S.**
  1. Delete `checkUserStatusProcedure` and its router entry.
  2. Delete the fallback block `login/page.tsx:82-106`.
  3. If nothing else imports `userStatusProbeRateLimit`, delete it too.

  Trade-off: on the rare gate-DB-error path the user sees the generic error instead of a redirect. This is a breaking change on a public tRPC procedure, but the only consumer is in this repo.

- (B) The issue's collapse to `pending | rejected | null`. It keeps a narrower oracle (pending and rejected accounts), so not recommended.
- (C) Require the password, which just re-implements sign-in.
- Keep the rate limit regardless only under (B). Fix the misleading "fail closed" comment in passing either way.

**Sibling worth its own issue, out of scope:** sign-up deliberately restores an "already exists" error (`server/auth/config.ts:36-39`, `server/auth/sign-up-guard.ts:26-28`, "User already exists. Use another email."), overriding Better Auth's built-in enumeration protection. That is another registration oracle.

### 4. Tests

- Existing near the code: `__tests__/server/auth/session-gate.test.ts` (covers the `ACCOUNT_PENDING` / `ACCOUNT_REJECTED` codes, `:67-80`), `registration.test.ts`, `sign-up.test.ts`, `__tests__/lib/rate-limit*.test.ts`, `get-client-ip.test.ts`.
- New:
  1. The auth router no longer exposes `checkUserStatus` (caller test via `createCaller`, or a router-shape assertion).
  2. The session-gate tests stay green. Optionally add a test that a wrong password for a pending user returns the generic credentials error, not `ACCOUNT_PENDING`. This proves the remaining path isn't an oracle; it needs Better Auth in the test or an integration seam.
  3. If (B) is chosen instead: unknown email and approved user produce byte-identical responses.

### 5. Open PRs

**#560** rewrites the toast strings in `app/(auth)/login/page.tsx`. That is a textual conflict, not a semantic one. Land either first and rebase the other.

### 6. Size and coupling

S, independent of the other four issues. Coordinate the merge order with #560.

---

## Suggested PR plan (one PR per issue)

1. `fix(auth): remove unauthenticated checkUserStatus probe` (#480): S, no migration, ships now; rebase around #560.
2. `fix(account): fail closed when storage cleanup fails during user deletion` (#464): S, no migration, ships now. Tombstones are a later option if product picks "never block deletion".
3. Land **#550**, then `fix(files): dedupe forced reprocess deliveries and keep refreshing files searchable` (#462 residuals): S, no migration (jsonb run id).
4. `fix(files): mark upload retryable when the processing job can't be queued` (#463, narrowed): S, no migration. After #550.
5. `fix(chat): allow one in-flight turn per conversation` (#465): M, no migration (jsonb marker). Client and route messaging after #560.

None of the recommended minimal fixes needs a schema migration. The migration-bearing alternatives (#462 run-id column, #463 outbox, #464 tombstones, #465 `turn_index`) each need a scratch-DB dry run and renumbering against #340 and #550.

## Evidence notes

- Read this session: all five issue bodies (no comments on any of them); the files and line ranges cited above at `origin/main` `ad356f3`; PR #550 head (`pipeline.ts`, `file-index-storage.ts`, and diffs of `qstash.ts`, `retry.ts`, `finalize-upload.ts`, `reprocess.ts`, `process-file/route.ts`); `gh pr list` file lists; git history of `finalize-upload.ts` and `create-file-record.ts`.
- Not checked this session, from training knowledge: QStash at-least-once delivery semantics, and Better Auth creating the session only after password verification. Both are flagged inline. The second should be confirmed with a test before #480 merges.
