<div align="center">
  <h1>Teach Anything</h1>
  <h3>AI-Powered Education Platform</h3>
  <p>Create intelligent chatbots from your course materials using RAG.</p>
</div>

<p align="center">
  <a href="https://github.com/akhileshrangani4/teachanything/blob/main/LICENSE"><img src="https://img.shields.io/github/license/akhileshrangani4/teachanything" alt="License" /></a>
  <a href="https://github.com/akhileshrangani4/teachanything/commits/main"><img src="https://img.shields.io/github/last-commit/akhileshrangani4/teachanything" alt="Last Commit" /></a>
</p>

<p align="center">
  <strong>New here?</strong> Start with <a href="./CONTRIBUTING.md">CONTRIBUTING.md</a> before opening an issue or PR. Using an AI coding assistant? Read <a href="./AGENTS.md">AGENTS.md</a>.
</p>

---

## What is Teach Anything?

Teach Anything is a production-ready platform for creating AI chatbots that answer questions using your course materials. Upload PDFs, Word docs, and more—the AI uses RAG (Retrieval-Augmented Generation) to provide accurate, context-aware responses.

## Features

- **7 Open-Source Models** — Llama 3.3 70B, Llama 4 Maverick, Mistral Large 2411, Qwen 3 235B, GPT-OSS 120B, NVIDIA Nemotron 3 Super, Gemma 4 31B
- **RAG Pipeline** — HNSW-indexed semantic search with source attribution, file manifest, and token budgeting so answers cite the exact file and chunk they came from
- **File Ingestion** — PDF, Word, PowerPoint (with slide boundaries and speaker notes), and Markdown, processed asynchronously via QStash
- **Web Crawler** — Auto-discover and index pages from a root URL with depth/page limits, include/exclude patterns, re-crawl detection via content hashing, and JSON export
- **Conversation Analytics** — Professors can browse, search, and replay every student conversation with sort, pagination, and cited sources
- **Embeddable Widget** — Drop a chatbot into any website with a single script tag
- **Professor Approval Workflow** — Admin-controlled registration, domain allow-listing, and self-service account deletion
- **Legal Pages + Account Deletion** — Privacy Policy and Terms of Use pages, plus self-service deletion with password confirmation
- **Tested & Type-Safe** — 350+ Jest tests, strict TypeScript, end-to-end type safety via tRPC, CI with Codecov

## Get Started

```bash
git clone https://github.com/akhileshrangani4/teachanything.git
cd teachanything
npm install
docker compose up -d                     # Start PostgreSQL (port 5433)
cp apps/web/.env.example apps/web/.env   # Configure environment
npm run db:push                          # Push database schema
npm run db:seed                          # Seed demo data (users, chatbots, files)
npm run dev                              # Start development server
```

Visit http://localhost:3000 and login with the credentials printed by `db:seed`.

Only Docker, an [OpenRouter API key](https://openrouter.ai/), and an [OpenAI API key](https://platform.openai.com/) (for embeddings) are required to get started. See [SETUP.md](./SETUP.md) for detailed configuration.

## Documentation

User-facing guides live at **[teachanything.ai/docs](https://teachanything.ai/docs)** — how-tos for instructors and students plus step-by-step tutorials. The docs are a Blume static site sourced in [`apps/docs`](./apps/docs) and served at `/docs`.

For developers, see [SETUP.md](./SETUP.md) (environment configuration), [CONTRIBUTING.md](./CONTRIBUTING.md) (development setup), and [AGENTS.md](./AGENTS.md) (coding standards).

## Tech Stack

| Category           | Technologies                                   |
| ------------------ | ---------------------------------------------- |
| **Framework**      | Next.js 16, React 19, TypeScript, Turborepo    |
| **API**            | tRPC (end-to-end type-safe)                    |
| **Database**       | PostgreSQL, Drizzle ORM, pgvector              |
| **Auth**           | Better Auth (email/password + approval)        |
| **AI**             | OpenRouter, Vercel AI SDK, LangChain           |
| **Infrastructure** | Upstash Redis/QStash, Supabase Storage, Resend |
| **UI**             | Shadcn UI, Tailwind CSS                        |

## Repository Structure

```
teachanything/
├── apps/web/           # Next.js application
│   ├── src/app/        # Pages & API routes
│   ├── src/components/ # UI components
│   └── src/server/     # tRPC routers (incl. rag-context, analytics, crawler)
├── apps/docs/          # User guides (Blume static site, served at /docs)
├── packages/
│   ├── db/             # Database schema (Drizzle, pgvector, HNSW index)
│   ├── ai/             # Model registry, RAG service, web crawler, token budgeter
│   └── logger/         # Shared structured logger
```

## Development

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Build all packages
npm run lint         # Lint codebase
npm run test         # Run test suite
npm run db:push      # Push schema to database
npm run db:seed      # Seed demo data
npm run db:studio    # Open Drizzle Studio
npm run stop         # Stop PostgreSQL container
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, [SETUP.md](./SETUP.md) for environment configuration, and [AGENTS.md](./AGENTS.md) for coding guidelines.

## License

[GNU Affero General Public License v3.0](./LICENSE)

---

<p align="center">
  <strong>Built for educators, powered by AI.</strong>
</p>
