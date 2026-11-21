> Research document: teachanything tests, CI drift check & quiz leak.
> Exported from the Obvious project _Teachanything Issue Triage_ on 2026-11-17. Source: `art_ZmzNcvmk`.

# Research — teachanything tests, CI drift check & quiz leak

Issues: **#399** (Jest ESM / top-level await), **#515** (live-DB schema drift check), **#398** (quiz leaked as raw JSON).
Basis: `origin/main` @ `ad356f3` (release 1.37.0), checked out in an isolated repo sandbox on 2026-11-13. Read-only: no branches pushed and no PRs opened. Scratch probe files were deleted afterwards.

Evidence labels used below: **[ran]** = I executed it this session and saw the output. **[read]** = I read the code or config at the cited line. **[inferred]** = my reasoning, not executed. **[training]** = from my background knowledge, not checked this session.

---

## TL;DR

| Issue | Status on main                                                                                                                                                                                                                                                          | Root cause                                                                                                                                                                                                      | Recommended shape                                                                                                                                                                                                                                                                             | Size |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| #399  | **Does not reproduce under `npm run test` or CI.** It reproduces only when Jest runs without `NODE_OPTIONS=--experimental-vm-modules`, and then **23** web suites fail, not 5. A separate real bug: the mocking pattern documented in AGENTS.md is **inert** under ESM. | Jest has to run in VM-modules mode. Bare `npx jest` and IDE runners drop the flag, so ts-jest falls back to CJS. The docs recommend `jest.mock`, which does nothing to ESM imports.                             | Fix the docs to use `jest.unstable_mockModule`, convert the 2 suites that rely on inert `jest.mock`, and add a fail-fast guard when the flag is missing. **Do not migrate to Vitest now.**                                                                                                    | S    |
| #515  | Confirmed gap. No step compares the DB with `schema.ts`.                                                                                                                                                                                                                | Gates compare code with code (`auth-schema.test.ts`), never code with the DB.                                                                                                                                   | A pure diff module plus a script in `packages/db`, wired into `release-please.yml` between "Run database migrations" and "Merge main into production". It reuses the existing `DATABASE_URL` secret. An ephemeral-DB PR job is optional and first needs a fresh-DB migrate fix (found below). | S–M  |
| #398  | The band-aid from the issue is **already merged** (#400, then #432/#433/#446/#453). Raw-JSON leaks from tool-capable primary turns are recovered.                                                                                                                       | Models write the tool call into the text channel. Three things are still missing: the recovery is **not logged**, the **no-tools fallback turn has no recovery**, and there is **no provider-routing control**. | Log every recovery with `modelId`, apply recovery to the fallback turn, run a per-model audit harness (needs an `OPENROUTER_API_KEY`), and evaluate OpenRouter `provider.require_parameters`. Reject client-side JSON rendering.                                                              | M    |

**Does #399 gate test-writing for #515 or #398? No.** CI and `npm run test` are green today: 95 suites, 1,209 tests [ran]. New tests can land now if they follow the pattern that actually works: `jest.unstable_mockModule(...)` followed by top-level `const { x } = await import(...)`. They should not use the `jest.mock` pattern currently shown in AGENTS.md §12. One soft dependency remains: if #399 rewrites AGENTS.md §12 first, new tests should match the rewritten text.

---

## Repo conventions

- **Package manager:** npm workspaces (`packageManager: npm@11.4.2`) with Turborepo 2. `engines.node >=24`; CI uses Node 24 (the CI log shows 24.22.1). The sandbox has Node 20.20.2 and npm 10.8.2, and the full suite still passed there [ran].
- **Packages:** `apps/web` (Next 16, React 19, tRPC 11), `apps/docs`, `packages/db` (Drizzle 0.45.2, drizzle-kit 0.31.10, postgres.js), `packages/ai`, `packages/logger`, `packages/eslint-config`. Every package is `"type": "module"`.
- **Commands** (root `package.json`):
  - `npm run test` runs `turbo run test`; each package runs `NODE_OPTIONS=--experimental-vm-modules jest`.
  - `npm run check-types` runs `tsc --noEmit` per package; `npm run lint` runs `eslint . --max-warnings 0` in web.
  - `npm run format:check` runs Prettier 3.9.10.
  - `npm run db:migrate` (packages/db) runs `db:setup-extensions && drizzle-kit migrate && db:check-indexes`.
- **Jest:** ts-jest with `useESM: true` and `extensionsToTreatAsEsm`. Web uses jsdom, `setupFilesAfterEnv: test/jest.setup.ts`, and `moduleNameMapper` for `@/` and `@teachanything/*`. ai and db use the node environment.
  - Coverage thresholds: web branches 30 / lines 4; ai 10 / 10; db lines 10.
  - Tests live in `__tests__/` and are named `<module>.test.ts`. Globals are imported explicitly from `@jest/globals`.
- **CI workflows** (`.github/workflows/`):
  - `build.yml`: `npm ci`, then `format:check`, `check-types`, `lint`, and `build` with `SKIP_ENV_VALIDATION=1`.
  - `test.yml`: `npm run test -- -- --coverage`, then Codecov upload with `fail_ci_if_error: false`.
  - `conventional-commits.yml`: the job `validate-pr-title` is the required status check in the main ruleset. Allowed types: feat, fix, perf, deps, revert, docs, style, chore, refactor, test, build, ci.
  - `automation-labels.yml`: area and change labels.
  - `release-please.yml`: release PR; on release, `deploy-production` runs `db:migrate` against the `DATABASE_URL` secret and then merges main into the `production` branch.
- **Hooks:** Husky pre-commit runs `lint-staged` (Prettier), `check-types`, `lint`, and `test`.
- **Commit and PR titles:** `type(scope): description`, for example `feat(chat): …`, `fix(quiz): …`, `chore(main): release 1.37.0`. PRs are squash-merged (title ends with `(#N)`). Release-please manages versions.
- **AGENTS.md §15:** do not add, upgrade, or remove dependencies, or modify tool configs, unless asked. This matters for the #399 and #515 options.

---

## #399 — Jest ESM / top-level await

### What I ran on origin/main

| Invocation                                                            | Result                                                                 |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `cd apps/web && npm test` (sets the VM-modules flag)                  | **82/82 suites, 1,096 tests pass** [ran]                               |
| `npx turbo run test --force -- --coverage` (the CI command, uncached) | db 4/4 (32 tests), ai 9/9 (81), web 82/82 (1,096): **all green** [ran] |
| Latest `test.yml` run on main (`ad356f3`, run 41252553968)            | Same counts, `Tasks: 3 successful` [ran: `gh run view --log`]          |
| `cd apps/web && npx jest` (**no** NODE_OPTIONS)                       | **23 failed / 59 passed / 82**, exit code 1 [ran]                      |
| `cd packages/ai && npx jest` (no flag)                                | 2 failed: `extract-pdf.test.ts`, `extract-powerpoint.test.ts` [ran]    |
| `cd packages/db && npx jest` (no flag)                                | 1 failed: `db-client.test.ts` [ran]                                    |

**Conclusion:** The 5 suites named in the issue (`rate-limit`, `resend-segment`, `files-validation`, `transcribe-route`, `user-deletion`) **pass** under `npm run test`. The `await Promise.resolve().then(() => __importStar(require(...)))` error in the issue appears only when Jest runs without `--experimental-vm-modules`. In that mode ts-jest emits CommonJS and top-level `await` becomes a syntax error.

The `NODE_OPTIONS` prefix has been in the package scripts since #152 (2026-02-24). The issue was filed on 2026-07-19, so the reporter most likely ran `npx jest` directly or used an IDE runner [inferred].

The issue also says suite-load failures do not fail CI. That is incorrect: a single failing suite exits with code 1 [ran], so CI would go red.

### Every suite that fails without the flag (web, 23)

- **21 fail with `SyntaxError: await is only valid…`** (top-level `await import()` compiled to CJS): `crawl/page-claim`, `user-deletion`, `files-validation`, `resend-segment`, `rate-limit`, `transcribe-route`, `chat/cut-off-turn`, `auth/domain-check`, `chat/failed-turn`, `auth/session-gate`, `auth/registration`, `files-storage-cleanup`, `retrieval-tool-recovery`, `create-file-record`, `chat/turn-persistence`, `chat/text-sequence-guard`, `crawl-stale`, `reprocess`, `hooks/use-crawler-mutations`, `process-file-route`, `logger-cause`.
- **2 fail with `Must use import to load ES Module`** (ESM-only `better-auth` / `@better-auth/core` loaded from CJS): `auth/sign-up.test.ts`, `auth-schema.test.ts`.

The second group shows that refactoring tests back to CJS is a dead end. The dependencies are ESM-only.

### The real bug: the documented mock pattern is inert

AGENTS.md §12 (lines 300–313) and CONTRIBUTING.md:172 tell contributors to call `jest.mock("@/lib/env", …)` and then `await import(...)`. In Jest's ESM mode, `jest.mock` does not apply to ESM imports; only `jest.unstable_mockModule` does.

- **Probe [ran]:** a scratch test did `jest.mock("@/lib/logger", () => ({ logWarn: "MOCKED" }))` followed by `await import("@/lib/logger")`. It received the real `[Function logWarn]`. The file was deleted afterwards.
- **Usage in the repo:** 18 web suites (and 3 in packages) already use `jest.unstable_mockModule`. Two web suites still use the inert `jest.mock`:
  - `apps/web/src/__tests__/lib/rate-limit.test.ts:5-14` mocks `@upstash/*`, `@/lib/env`, and `@/lib/logger`. None of these mocks take effect.
  - `apps/web/src/__tests__/server/files-validation.test.ts:4-6` mocks `env.NEXT_PUBLIC_MAX_FILE_SIZE_MB = "50"`. It passes only because `validation.ts:91` defaults to 50 (`Number(env.NEXT_PUBLIC_MAX_FILE_SIZE_MB) || 50`).

Both suites are green by coincidence, and every new contributor who follows the docs writes mocks that do nothing.

### Fix options

| Option                                       | What it fixes                                                                                                                                                                                                                                                                                                          | Cost / blast radius                                                                                                                                                                                                                                                              | Verdict                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **A. Correct docs and suites, plus a guard** | AGENTS.md §12 and CONTRIBUTING.md show `jest.unstable_mockModule`. Convert `rate-limit` and `files-validation`. Make each `jest.config.ts` throw a clear error ("run via `npm test`; Jest needs --experimental-vm-modules") when `process.execArgv`/`NODE_OPTIONS` lacks the flag. Optionally add `test:file` scripts. | 2 test files, 2 docs, 3 Jest configs. No dependency changes. A config change needs explicit approval (AGENTS.md §15).                                                                                                                                                            | **Recommended**                                         |
| B. Make bare `npx jest` work                 | `.npmrc` `node-options` affects only npm scripts [training]. Jest has no config key for Node flags [training]. A `bin` wrapper is possible.                                                                                                                                                                            | Little gain over A's guard.                                                                                                                                                                                                                                                      | Fold into A's guard message                             |
| C. Refactor TLA into `beforeAll`             | Nothing. `unstable_mockModule` still needs ESM mode, and ESM-only deps still break CJS (see the `better-auth` failures).                                                                                                                                                                                               | 23+ files touched                                                                                                                                                                                                                                                                | Reject                                                  |
| D. Migrate to Vitest                         | Native ESM, hoisted `vi.mock`, no flag needed.                                                                                                                                                                                                                                                                         | 95 suites; 29 files with 193 `jest.*` references (119 `jest.fn`, 51 `unstable_mockModule`, 6 `jest.mock`, 5 `spyOn`, plus timers); 65 web suites on jsdom; alias setup; a new dependency that conflicts with AGENTS.md §15; and churn against the open dependency PRs #547/#558. | Not now. Revisit only if Jest's ESM mode keeps hurting. |

**Optional CI hardening:** CI already fails on any suite that cannot load. A suite-count or `--passWithNoTests`-style guard adds little value [inferred]. A coverage gate is already configured; Codecov does not fail CI (`fail_ci_if_error: false`).

**Tests that prove A:**

- The two converted suites gain assertions that their mocks took effect, for example `expect(logWarn).toHaveBeenCalled()` on the fail-open path, and a non-default `MAX_FILE_SIZE_MB` (such as `"5"`) that changes the outcome.
- Bare `npx jest` prints the guard message instead of 23 syntax errors.

**Open PRs touching it:** none target #399. **#550, #560 and #561 all modify `files-validation.test.ts`**, so converting that file risks merge conflicts. Land the #399 change and ask those PRs to rebase, or convert it after they merge.

**Size:** S (about half a day).

---

## #515 — Live DB vs declared schema

### What the author asks for

- A script in `packages/db/scripts/` that diffs the Drizzle schema against a live DB and exits non-zero on missing **tables**, **columns**, or **enum values**. Columns that exist in the DB but not in code produce a **warning only**.
- Wire it into `release-please.yml` after `db:migrate` and **before** the production merge, using the same `DATABASE_URL` secret.
- Verify it by watching it **fail** against a DB that is missing a column.
- Name the exact `table.column` in the output.
- Mechanics: `prepare: false` (transaction pooler, see `packages/db/src/db.ts:16-43`), run inside a **read-only transaction** (session `SET` leaks on the pooler), and read `information_schema` **once**.
- The author says PR-time runs are "nice but not where the value is".

### Confirmation on main

- **Tooling:** Drizzle ORM 0.45.2 and drizzle-kit 0.31.10 (`packages/db/drizzle.config.ts`: `strict: true`, `out: ./drizzle`). Migrations run from 0000 to 0020 [read]. `drizzle-kit` commands include `generate`, `migrate`, `push`, `check`, and `introspect` [ran `--help`]. `check` validates the migrations folder, not a live DB [training].
- **Gates on main:**
  - `auth-schema.test.ts:30-58` compares Better Auth's expected fields with **Drizzle objects**.
  - `packages/db/src/__tests__/schema.test.ts` checks enum and table definitions in code only.
  - `release-please.yml` runs `deploy-production` (line 34), then "Run database migrations" (line 60), then "Merge main into production branch" (line 71). Nothing sits between the migration and the merge [read].
- **Template to copy:** `scripts/check-index-health.ts` paired with the pure `src/index-health.ts` (an exported query and formatter, unit-tested in `index-health.test.ts`), already chained into `db:migrate` [read].

### Prototype [ran]

I installed Postgres 17 and pgvector 0.8.0 (Debian apt) in the sandbox. Production uses Supabase and docker-compose uses `pgvector/pgvector:pg16`, so the version differs.

The prototype used `getTableConfig` over every exported `PgTable`, `isPgEnum` over the exports, and one read-only transaction (`sql.begin("read only", …)`) that read `information_schema.columns` and `pg_enum` for `public`.

- **After migrations, clean DB:** `tables in code: 17 | tables in db: 17 | enums in code: 7`, no drift, **exit 0**.
- **After `ALTER TABLE account DROP COLUMN scope; ADD COLUMN legacy_x`:** `MISSING COLUMNS [ 'account.scope' ]`, `EXTRA (warn) [ 'account.legacy_x' ]`, **exit 1**.

This matches the incident output quoted in the issue. The approach works with about 40 lines of logic.

### Finding: `npm run db:migrate` fails on an empty database [ran]

`db:setup-extensions` runs first, and `setup-extensions.sql` contains `CREATE INDEX CONCURRENTLY IF NOT EXISTS file_chunks_fts_gin ON file_chunks …`. On a fresh DB this fails with `relation "file_chunks" does not exist`. Migration 0000 also needs the `vector` extension, so the order cannot simply be reversed.

Verified workaround: run `CREATE EXTENSION vector, pg_trgm`, then `drizzle-kit migrate`, then `setup-extensions.ts`, then `check-index-health.ts`. All steps succeeded.

This does not affect production, where the table already exists. It **blocks any ephemeral-DB CI job** and fresh local setups that use `db:migrate` rather than `db:push`. The fix is to split the extension statements, which must run before migrations, from the index statements, which must run after.

### Recommended shape

1. **`packages/db/src/schema-drift.ts` (pure):**
   - `collectDeclared(schemaModule)` returns tables, columns, and enums.
   - `diffSchema(declared, dbColumns, dbEnums)` returns `{ missingTables, missingColumns, missingEnumValues, extraColumns }`.
   - A `formatDriftReport` function and the SQL constants.
   - Filter `information_schema.columns` to base tables (join `information_schema.tables` with `table_type='BASE TABLE'`) so views do not count [inferred].
2. **`packages/db/scripts/check-schema-drift.ts`:** loads env the same way as `check-index-health.ts`, uses `postgres(url, { prepare: false, max: 1 })` with `sql.begin("read only", …)`, prints the report, and sets `process.exitCode = 1` on any missing item.
3. **`"db:check-schema"` script.** Either add it to the end of the `db:migrate` chain (every migrate checks itself, matching `db:check-indexes`), or add an explicit step in `release-please.yml` between lines 60 and 71 (clearer in CI logs). Choosing between the two is a person's call; both reuse **`secrets.DATABASE_URL`**, and no new secrets are needed.
4. **Optional PR job** (the author ranks it lower): a `pgvector/pgvector:pg16` service container, the extension and migrate ordering fix, `db:migrate`, then `db:check-schema`. This catches a `schema.ts` edit that has no migration, a case the deploy-time check misses until release. It needs no secrets.

### Alternatives considered

- **`drizzle-kit push --strict` in dry run:** it has no clean non-interactive dry-run mode that reports and exits [training]. Reject.
- **`drizzle-kit introspect` + diff:** it writes files and produces noisy diffs. Reject.
- **Full type and nullability diff:** possible later. The issue scopes it to existence checks, so keep the first version narrow.

### Tests

- Unit tests for `diffSchema`/`formatDriftReport` in `packages/db/src/__tests__/schema-drift.test.ts` (node environment, no DB): a missing column, a missing table, an extra column producing a warning only, a missing enum value, and the exact `table.column` output.
- **Acceptance verification:** run the script against a DB with one column dropped and watch it exit 1, as in the prototype above.

**Open PRs touching it:**

- **#550** modifies `packages/db/src/schema.ts`.
- **#340** adds migration `0019_true_mole_man.sql` plus a 0014 snapshot, and conflicts with main.

Neither blocks a drift check, and both are exactly the kind of change it would guard.

**Size:** S for the script, tests, and release step. Add about S for the optional PR job with the migrate-order fix.

---

## #398 — Quiz leaked as raw JSON

**Load-bearing assumption:** the issue assumes the leaks are model-specific, so fixing the model registry or routing would make native tool calls reliable. Nothing in the repo pins leaks to specific models, because recoveries are not logged (see below). A per-model audit with real API calls would confirm or break the assumption; run it before deprecating any model. Two other explanations the issue does not consider: OpenRouter routing the same model to different upstream providers with uneven tool support, and prompt or history shape (prior quiz tool parts in the history) nudging models to imitate the call in text.

### Pipeline on main [read]

1. `stream-chat.ts:154` sets `modelCanUseTools = modelSupportsTools(chatbot.model)`. All 5 registry models have `supportsTools: true` (`packages/ai/src/models.ts:21-53`). When true, `studyTools` (`showQuiz`, `server/chat/study-tools.ts:14`) is added to the tool set, and the study addendum is added to the primary prompt (`prompt-assembly.ts:183`).
2. `primary-turn.ts:121-160` runs `streamText(...)` with `experimental_repairToolCall`, which fixes malformed **native** `showQuiz` calls and logs `logWarn("Repaired a malformed showQuiz call", { modelId })`.
3. `primary-turn.ts:162-173` converts the result with `toUIMessageStream`, then pipes it through `stripRetrievalOutputs` and `repairQuizToolParts`.
4. `primary-turn.ts:185-186` pipes the stream through `recoverLeakedQuiz()` **when `modelCanUseTools`**.
5. `recover-quiz.ts:49-306` watches text blocks for leak markers (`quiz-leak-detection.ts`). It holds the text after a marker and shows a `QuizSkeleton` placeholder once the text is clearly a quiz (≥ 600 characters, containing `quiz_title` and `"question":`). It then emits a synthetic `tool-input-available` part. If the held text fails to parse after the placeholder is up, it emits `tool-output-error` rather than releasing the answer key.
6. `turn-persistence.ts:100-110` keeps leaked-quiz turns even when the student aborts.
7. The client, `ChatMessage.tsx:129-160`, renders `text` parts verbatim through `MessageContent` and renders `tool-showQuiz` parts through `QuizMessage`.

The "proper fix" ideas in the issue are not done on main [read and grep]:

- **No logging when recovery fires.** `recover-quiz.ts` has no logger import or call, and `recoverLeakedQuiz()` takes no `modelId`. The issue's acceptance criterion "recovery net retained only as an explicitly-logged fallback" is unmet, and the leak rate per model cannot be measured.
- **The fallback turn has no recovery.**
  - The no-tools turn, `runFallbackTurn` (`primary-turn.ts:294-330`, called from `turn-endings.ts:182-193`), forwards its stream without `recoverLeakedQuiz`.
  - It receives `args.modelMessages`, which can include earlier `showQuiz` tool calls.
  - If a "quiz me" turn falls back (the primary produced nothing visible), a quiz written as JSON text would render raw [inferred; not reproduced].
- **No provider routing control.** `openrouter-client.ts:24-44` calls `createOpenRouter({ apiKey })` and `getModel` returns `this.client(model)` with no `provider` settings. The installed `@openrouter/ai-sdk-provider` 1.5.4 types expose `provider.require_parameters?: boolean` [read in `dist/index.d.ts`]. That setting restricts routing to upstream providers that support every request parameter, including tools [training].
- **No per-model reproduction.** The only model named in the code is Llama 4 Maverick, in a latency note (`recover-quiz.ts:19`). I could not reproduce live leaks: the sandbox has no OpenRouter key.

### Recommended fix shape (in order)

1. **Observability (S):**
   - Change the signature to `recoverLeakedQuiz({ chatbotId, modelId })`.
   - Log `logWarn("Recovered a showQuiz call leaked into text", { chatbotId, modelId, form: "json" | "fenced" | "pseudo-call", hadPreamble, outcome: "recovered" | "placeholder-error" })` in `closeBlock` and in the placeholder-error branch of `flushPending`.
   - This meets the logged-fallback criterion and supplies the data for step 3.
2. **Cover the fallback turn (S):** pipe `runFallbackTurn`'s UI stream through the same `recoverLeakedQuiz` when the bot is tool-capable. The client already renders synthetic `tool-input-available` parts. The alternative of stripping tool parts from fallback history (as `stripToolPartsForTextModel` already does for non-tool models) is cheaper but loses quiz context.
3. **Model audit harness (M, needs `OPENROUTER_API_KEY`):** a script, not a CI test. For each `MODEL_REGISTRY` entry it sends N un-forced "quiz me on X" prompts with `studyTools` and records native, leaked, or none. Deprecate or remap any model that leaks above a threshold through `DEPRECATED_MODEL_MAP`, following the Gemma/Nemotron pattern. Split `supportsTools` into separate capabilities (for example, retrieval tools versus study tools) only if the audit shows a model that is reliable at forced calls but leaks on un-forced ones.
4. **Routing experiment (S once 3 exists):** run the audit with and without `provider: { require_parameters: true }` on the leaky models. Adopt the setting if it lowers the leak rate without raising "No endpoints found" failures.

**Rejected or deprioritised:**

- **Client-side JSON fallback rendering:** it would split truth between client and server. Quiz attempts validate against the **persisted tool part** (`turn-persistence.ts` comments), so a client-only quiz could not be graded. The server already rewrites leaks into canonical parts.
- **Prompt changes:** cheapest but weakest. The study addendum already instructs the tool call, and models leak anyway.
- **Removing the recovery net:** only after the audit plus logs show it no longer fires.

### Tests

Existing tests [ran, all pass]:

- `recover-quiz.test.ts` (31 `it`), `lib/quiz.test.ts` (57), `repair-quiz-parts.test.ts` (12), and `truncated-quiz-stream.test.ts` (2).
- `leak-false-positives.test.ts` (corpus-driven).
- `stream-chat-turn.test.ts` and `multi-step-text.test.ts`.

New tests:

- **(a)** `recover-quiz.test.ts`: with `@/lib/logger` mocked through `jest.unstable_mockModule`, a JSON leak produces exactly one `logWarn` call carrying `modelId` and `form`; ordinary prose produces none.
- **(b)** A fallback-turn test (alongside `failed-turn`/`cut-off-turn`, which already mock `streamText`): a fallback stream that emits quiz JSON as text yields a `tool-showQuiz` part, not text.
- **(c)** If routing is adopted, an `openrouter-client` unit test that `getModel` passes the provider settings.

All of these can be written on main today; #399 does not block them.

**Open PRs touching it:**

- **#547** (dependabot major) bumps **`ai` 6 → 7 and `@openrouter/ai-sdk-provider` 1.5.4 → 3.1.0**. `recoverLeakedQuiz` and `ui-chunks.ts` depend on the shape of the AI SDK's UI chunks, and provider options may move. Sequence #398 before #547, or re-verify after.
- **#558** bumps `better-auth` and `next` (lockfile only for these).
- **#560** (i18n) modifies `ChatMessage.tsx`, `QuizMessage.tsx`, `quiz-*-view.tsx`, and `app/api/chat/route.ts`. It overlaps only if #398 touches the client, which this plan avoids.

**Size:** M overall. Steps 1 and 2 are S and can ship without an API key; steps 3 and 4 need a key and live runs.

---

## Cross-issue file overlap

|              | #399                                             | #515                                                                    | #398                                                                    |
| ------------ | ------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **#399**     | —                                                | none (packages/db tests already use `unstable_mockModule` where needed) | AGENTS.md §12 is the pattern #398's new tests follow; no source overlap |
| **#515**     |                                                  | —                                                                       | none                                                                    |
| **Open PRs** | #550/#560/#561 modify `files-validation.test.ts` | #550 modifies `schema.ts`; #340 adds migrations                         | #547 (`ai` v7, provider v3); #560 (client chat UI)                      |

The three issues can be built in parallel. The suggested order is #399 first (small; it fixes the docs everyone else copies), then #515 and #398 steps 1–2 in parallel, then the #398 audit once an `OPENROUTER_API_KEY` is available.

## Not verified in this session

- Live LLM leak reproduction for any model (no API key).
- Supabase-specific behaviour of the read-only transaction through the transaction pooler. Verified only on local PG17 over a direct connection.
- Whether the `ai` v7 bump in #547 changes the chunk types `recoverLeakedQuiz` relies on.
- Exactly how the #399 reporter invoked Jest. The cause above is inferred from the reproduced error signature.
