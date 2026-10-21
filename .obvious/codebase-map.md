# Codebase Map — teachanything

Turborepo monorepo, npm workspaces. Depth 2.

| Path                                                               | What it is                                                                                               |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `apps/web/`                                                        | Next.js 16 application (port 3000) — the product                                                         |
| `apps/web/src/app/`                                                | App Router pages & API routes (`(auth)`, `(dashboard)`, `(admin)`, `api/trpc`, `embed`)                  |
| `apps/web/src/server/`                                             | Server-only code — never import from a client component                                                  |
| `apps/web/src/server/routers/`                                     | tRPC routers: `auth`, `chatbot`, `files`, `analytics`, `admin`, `crawler`                                |
| `apps/web/src/server/auth/`                                        | Better Auth config, domain allow-list, session gate, sign-up guard                                       |
| `apps/web/src/server/chat/`, `file-processor/`, `crawl-processor/` | Chat turn pipeline; upload → extract → chunk → embed; crawl → index pipelines                            |
| `apps/web/src/lib/`                                                | Client-safe utilities (env with zod validation, logger, formatting)                                      |
| `apps/web/src/components/`, `src/hooks/`                           | Shadcn-based UI components; React hooks                                                                  |
| `apps/docs/`                                                       | User guides — Blume static site, embedded at build time, served at `/docs`                               |
| `packages/db/`                                                     | `@teachanything/db` — Drizzle schema (`src/schema.ts`), seed/extension/RLS scripts                       |
| `packages/ai/`                                                     | `@teachanything/ai` — OpenRouter client, RAG service, crawler, model registry, token budget              |
| `packages/logger/`                                                 | `@teachanything/logger` — shared structured logger                                                       |
| `packages/eslint-config/`, `packages/typescript-config/`           | Shared lint/ts configs                                                                                   |
| `.github/`                                                         | Workflows, templates, dependabot, codecov config                                                         |
| `diagrams/`                                                        | Architecture and flowchart diagrams                                                                      |
| Root                                                               | `turbo.json` (task graph + env allowlist), `docker-compose.yml` (Postgres 5433), `AGENTS.md` (standards) |

Key facts: `apps/web/src/server/` is server-only by convention; env validation is
`apps/web/src/lib/env.ts`; DB schema is a single Drizzle file in `packages/db`.
