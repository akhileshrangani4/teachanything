# Obvious — akhileshrangani4/teachanything

AI-powered education platform: instructors create chatbots grounded in their course
materials (PDF/DOCX/PPTX/MD + web crawler) using RAG. Next.js 16 monorepo managed by
Turborepo and npm.

## Stack

| Layer                      | Technology                                                              |
| -------------------------- | ----------------------------------------------------------------------- |
| Web app                    | Next.js 16 (App Router, Turbopack), React 19, TypeScript 5.9            |
| API                        | tRPC 11 (routers in `apps/web/src/server/routers/`)                     |
| Database                   | PostgreSQL + Drizzle ORM + pgvector (HNSW index)                        |
| Auth                       | Better Auth 1.7 (email/password + admin approval workflow)              |
| AI                         | OpenRouter (LLMs), OpenAI (embeddings), Vercel AI SDK, LangChain        |
| Docs site                  | Blume static site in `apps/docs`, embedded into the web app at `/docs`  |
| External (optional in dev) | Upstash Redis/QStash, Supabase Storage, Resend — all degrade gracefully |

## Commands (run from repo root)

```bash
npm install            # npm workspaces + turborepo (packageManager: npm; do not use bun)
docker compose up -d   # Postgres 16 + pgvector on host port 5433
cp apps/web/.env.example apps/web/.env   # then fill required vars (see below)
npm run db:push        # push Drizzle schema (also enables pgvector)
npm run db:seed        # demo data; prints credentials to console
npm run dev            # dev servers (web on port 3000, docs site)
npm run lint           # eslint across workspaces
npm run check-types    # tsc --noEmit across workspaces
npm run test           # jest suites (db, ai, web)
npm run stop           # docker compose down
```

## Required environment (`apps/web/.env`)

`DATABASE_URL`, `BETTER_AUTH_SECRET` (min 32 chars), `BETTER_AUTH_URL`,
`OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `NEXT_PUBLIC_APP_URL`, `ADMIN_EMAILS`.
Validation lives in `apps/web/src/lib/env.ts`; `SKIP_ENV_VALIDATION=1` bypasses it (CI proxy).
Optional vars (Supabase/Resend/Upstash/QStash) are documented in `apps/web/.env.example`.
Dummy API keys let the app boot and auth work; real keys are only needed for chat/RAG.

## Services and ports

| Service                  | Port        | Source of truth                                                          |
| ------------------------ | ----------- | ------------------------------------------------------------------------ |
| Web app (dev)            | 3000        | `apps/web` `dev` script: `next dev --turbopack --port 3000`              |
| PostgreSQL 16 + pgvector | 5433 (host) | `docker-compose.yml`, db/user/pass `teachanything`/`postgres`/`postgres` |

## Seeded demo logins (from `npm run db:seed`)

- Admin: first entry of `ADMIN_EMAILS` (default `admin@example.com`) / `admin123`
- Professor: `professor@demo.edu` / `demo123` — 3 chatbots, 6 fixture files, RAG embeddings
- Pending student: `student@demo.edu` / `demo123` (for the approval workflow)

## Known first-run quirks (work around, don't "fix" casually)

1. **`npm run db:push` fails on a pristine database.** `packages/db/scripts/setup-extensions.sql`
   creates a GIN index on `file_chunks` before `drizzle-kit push` creates the table.
   Workaround: `npx drizzle-kit push --force` in `packages/db` first, then
   `npx tsx scripts/setup-extensions.ts`, then `npx tsx scripts/check-index-health.ts`.
2. **Seeded logins return 401.** The seed inserts `account.account_id = <email>`, but
   Better Auth 1.7.5 requires `account.accountId === user.id` for credential accounts.
   Workaround: `UPDATE account SET account_id = user_id WHERE provider_id='credential';`
3. `package.json` `engines` requires Node >= 24; Node 20.x works in practice but shows an
   engine warning. There is also a stray untracked `bun.lock` — npm is the package manager.

## Codebase map

See [codebase-map.md](./codebase-map.md).

## Local verification (onboarding run, 2026-10-21)

- Postgres + pgvector up on 5433; schema pushed; extensions enabled; indexes valid; seeded.
- Dev server ready on port 3000 (`GET /` → 200).
- Primary flow verified end-to-end over HTTP: unauthenticated `chatbot.list` → 401;
  admin and professor sign-in via Better Auth → 200; authenticated tRPC CRUD round-trip
  (`chatbot.create` → list shows 4 chatbots → `chatbot.delete` → list shows 3).
- Quality gates: `npm run lint` pass, `npm run check-types` pass, tests 1203/1203 pass
  (db 32, ai 78, web 1093).
- Screenshots captured: home page and login page (headless Chromium).

## Sandbox snapshot

- Snapshot ID: `6eo6rw24wwdp00u8tyw1:default`
- Captured: 2026-10-21T16:54:02.613Z (live sandbox `i141nf0psjguutgq7ixfl`, dev stack healthy)

## Guidance docs

- `AGENTS.md` — coding standards and architecture rules (applies to every contribution)
- `SETUP.md` — full environment configuration
- `CONTRIBUTING.md` — contributor workflow; conventional commits required
