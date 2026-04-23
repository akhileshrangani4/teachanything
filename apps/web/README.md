# web

Next.js 16 web application for the Teach Anything AI chatbot platform.

This app is part of a Turborepo monorepo — run commands from the repo root.

## Docs

- [`../../README.md`](../../README.md) — project overview
- [`../../SETUP.md`](../../SETUP.md) — full setup guide
- [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) — contributor workflow
- [`../../AGENTS.md`](../../AGENTS.md) — coding standards for AI agents

## Local development

```bash
npm run dev         # from repo root
```

## Key directories

- `src/app/` — Next.js App Router pages + API routes
- `src/server/` — tRPC routers and server helpers
- `src/components/` — React UI (Shadcn-based)
- `src/lib/` — auth, env, rate-limit, qstash, file-processor, etc.
- `src/hooks/` — React hooks
