> Code review: teachanything PR #560 (dashboard i18n).
> Exported from the Obvious project _Teachanything Issue Triage_ on 2026-11-17. Source: `art_ScOGwJVi`.

# Code review — PR #560 (feat(i18n): dashboard in French, Spanish and German)

- **PR:** https://github.com/akhileshrangani4/teachanything/pull/560 (author `gum1x`, fork `feat/dashboard-i18n-upstream`)
- **Base:** `main` @ `ad356f3` (merge-base equals current `origin/main`)
- **Reviewed head:** `e6d98befb30061d04e60f7cd4d24fbae9da10c44`
- **Size:** 256 files, +13,311 / −2,245
- **Tier:** COMPLEX (schema migration + auth hook + error-contract change across tRPC and the chat routes)
- **Blocking bar (owner decision, spec D13):** only real defects — build/type/test failures, security, data loss, broken migration. Scope, PR size and the hard-coded Lingo.dev IDs are accepted.
- **lastReviewedHeadSha:** `e6d98befb30061d04e60f7cd4d24fbae9da10c44` · **passCount:** 1

## Pass 1 — head e6d98be

**Verdict: COMMENT — no blocking findings.** Check run `obvious/code-review` concluded `success`.

### Verification run locally on the PR head

| Check              | Command                                                             | Result                                                                                            |
| ------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Types              | `npm run check-types`                                               | exit 0                                                                                            |
| Lint               | `npm run lint`                                                      | exit 0                                                                                            |
| Tests              | `npm run test`                                                      | exit 0 — db 4 suites / 32 tests, ai 9 / 81, web 105 / 1,260 (118 suites, 1,373 tests, 0 failures) |
| Fresh-DB migration | `npm run db:migrate` on an empty PG 17.12 + pgvector 0.8.0 database | exit 0 — see below                                                                                |

### Fresh-database migration run (PG 17.12, pgvector 0.8.0, empty DB `ta_fresh`)

- `setup-extensions.sql` applied, then 22 Drizzle migrations applied (`drizzle.__drizzle_migrations` count 22), then `setup-indexes.sql` applied, then `db:check-indexes` reported "All indexes are valid".
- Result: 17 public tables; `user.preferred_locale` exists as nullable `text` (migration `0021_user_preferred_locale`); `file_chunks_fts_gin` exists as `gin (to_tsvector('english', content))` and `indisvalid = t`. Extensions: `vector 0.8.0`, `pg_trgm 1.6`, `plpgsql`.
- Idempotency: a second `db:migrate` against the same DB also exited 0 with every step succeeding.
- Baseline: `main`'s `db:setup-extensions` on a second empty DB fails with `relation "file_chunks" does not exist`. The PR's split into `setup-extensions.sql` (before migrate) and `setup-indexes.sql` (after migrate) fixes fresh-database setup.

### Areas reviewed and conclusions

- **Migration / schema:** `0021` adds one nullable column, no backfill, no destructive change. Journal entry and snapshot are consistent with the applied run. No data-loss path.
- **Auth / locale persistence:** `resolveLocale` takes the signed-in user's saved `preferredLocale`, then the `NEXT_LOCALE` cookie (only when signed out, so a shared browser's last choice never reaches another user), then `Accept-Language`, each checked with `isEnabledLocale`; anything else falls back to `en`. The dashboard and chatbot layouts moved the session gate into `DashboardShell`, which keeps the signed-out `router.push("/login")` redirect; data access is still gated by tRPC `protectedProcedure`.
- **Error contract:** tRPC errors now go through `appError(code, key, values)` — same TRPCError codes as before, English message rendered server-side plus a translation key for the client. Chat routes now return `{ code }` JSON via `chatErrorResponse`; `describeChatError` maps a known code to a translation key and otherwise falls back to the generic send-failed message, so unknown or legacy bodies do not leak raw JSON to students. Status codes are unchanged.
- **Crawler:** `verifyUrlReachable` now throws typed `UrlNotAllowedError` / `UrlUnreachableError`; the SSRF DNS check and redirect-hop re-check are unchanged.
- **Interpolation safety:** user-controlled values (file names, processing errors) are passed as ICU values, not concatenated into message templates; React escapes rendered output (`escapeValue: false` is the standard react-i18next setting).
- **GitGuardian:** the two findings are triaged by the owner (request `todo_IfQTgIhD` completed). The flagged lines in the es/fr catalogs are the localized `auth.fields.email` / `password` labels ("Correo electrónico", "Contraseña"), not credentials.

### Optional checks (non-blocking, reported)

- GitGuardian: failing, triaged by the owner.
- Vercel: requires authorization for the fork deployment.
- codecov/patch: 49.78% patch coverage, below target; optional.

### Suggestions

None.
