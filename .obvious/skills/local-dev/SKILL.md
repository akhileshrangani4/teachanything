---
name: local-dev
description: How to bring teachanything's dev stack up locally (validated during onboarding 2026-10-21)
---

# Local Dev — teachanything

Canonical flow (from SETUP.md): `npm install` → `docker compose up -d` (Postgres on
host port 5433) → `cp apps/web/.env.example apps/web/.env` → fill required vars →
`npm run db:push` → `npm run db:seed` → `npm run dev` (port 3000).

## Environment

`apps/web/.env` required keys: `DATABASE_URL`
(`postgresql://postgres:postgres@localhost:5433/teachanything`), `BETTER_AUTH_SECRET`
(≥32 chars), `BETTER_AUTH_URL=http://localhost:3000`, `OPENROUTER_API_KEY`,
`OPENAI_API_KEY`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`, `ADMIN_EMAILS`
(seed admin email). Dummy keys (`sk-or-v1-local-dummy`, `sk-local-dummy`) satisfy
validation and keep auth/admin working; real keys only unlock chat/RAG. Optional
services (Supabase, Resend, Upstash Redis/QStash) degrade gracefully — see
`.env.example` comments. All db scripts and drizzle-kit read `apps/web/.env`.

## Deviations used in the onboarding sandbox (no Docker available)

- Docker is unavailable in the obvious sandbox. Installed `postgresql-17-pgvector`
  via apt (Debian 13) and ran Postgres on `localhost:5433` with
  `unix_socket_directories=/tmp`, user `postgres`, database `teachanything`,
  extension `vector` (pgvector 0.8.0) — same contract as `docker-compose.yml`
  (which pins pg16; PG17+pgvector works).
- Command that worked: `/usr/lib/postgresql/17/bin/pg_ctl -D ~/.pg-ta-5433 -l /tmp/pg-ta.log -o "-p 5433 -c unix_socket_directories=/tmp" start`

## First-run bugs and workarounds (verified 2026-10-21)

1. **`npm run db:push` fails on a pristine database** — `setup-extensions.sql`
   runs `CREATE INDEX CONCURRENTLY ... ON file_chunks` before the table exists.
   Workaround: in `packages/db`, run `npx drizzle-kit push --force`, then
   `npx tsx scripts/setup-extensions.ts`, then `npx tsx scripts/check-index-health.ts`.
2. **Seeded credentials cannot log in** — seed writes `account.account_id = <email>`,
   but Better Auth 1.7.5 sign-in requires `account.accountId === user.id` for the
   credential provider (error: `INVALID_EMAIL_OR_PASSWORD`, log: "User not found").
   Workaround: `UPDATE account SET account_id = user_id WHERE provider_id='credential';`

## Verification recipe (what "working" looks like)

1. `npm run dev` → log shows `next dev --turbopack --port 3000`, `✓ Ready`.
2. `GET http://localhost:3000/` → 200 (landing page HTML).
3. Sign-in: `POST /api/auth/sign-in/email` with
   `{"email":"<ADMIN_EMAILS entry>","password":"admin123"}` → 200 + user JSON.
4. Auth guard: `GET /api/trpc/chatbot.list` without cookies → 401 UNAUTHORIZED.
5. CRUD round-trip (professor session cookie): `chatbot.create` → id returned;
   `chatbot.list` → totalCount 4; `chatbot.delete {id}` → success; list → 3.
6. Gates: `npm run lint`, `npm run check-types`, `npm run test` — all green
   (1203 tests across db/ai/web at onboarding time).

## Notes

- Node engines says >=24; Node 20.x runs everything but warns.
- `bun.lock` is an untracked stray; npm (`packageManager` field) is canonical.
- Dev also starts the `apps/docs` Blume site; its nav warnings in the log are non-fatal.
- Screenshots from onboarding: home page and `/login` via headless Chromium.
