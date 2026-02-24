<div align="center">
  <h1>Teach Anything</h1>
  <h3>AI-Powered Education Platform</h3>
  <p>Create intelligent chatbots from your course materials using RAG.</p>
</div>

<p align="center">
  <a href="https://github.com/akhileshrangani4/teachanything/blob/main/LICENSE"><img src="https://img.shields.io/github/license/akhileshrangani4/teachanything" alt="License" /></a>
  <a href="https://github.com/akhileshrangani4/teachanything/commits/main"><img src="https://img.shields.io/github/last-commit/akhileshrangani4/teachanything" alt="Last Commit" /></a>
</p>

---

## What is Teach Anything?

Teach Anything is a production-ready platform for creating AI chatbots that answer questions using your course materials. Upload PDFs, Word docs, and more—the AI uses RAG (Retrieval-Augmented Generation) to provide accurate, context-aware responses.

## Features

- **4 Open-Source Models** — Llama 3.3 70B, Mistral Large, Qwen 2.5 72B, GPT-OSS 120B
- **RAG-Powered** — Semantic search over your uploaded documents
- **Professor Approval** — Admin-controlled user registration
- **Analytics** — Track conversations and usage patterns
- **Embeddable** — Add chatbots to any website

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

## Tech Stack

| Category | Technologies |
|----------|-------------|
| **Framework** | Next.js 16, React 19, TypeScript, Turborepo |
| **API** | tRPC (end-to-end type-safe) |
| **Database** | PostgreSQL, Drizzle ORM, pgvector |
| **Auth** | Better Auth (email/password + approval) |
| **AI** | OpenRouter, Vercel AI SDK, LangChain |
| **Infrastructure** | Upstash Redis/QStash, Supabase Storage, Resend |
| **UI** | Shadcn UI, Tailwind CSS |

## Repository Structure

```
teachanything/
├── apps/web/           # Next.js application
│   ├── src/app/        # Pages & API routes
│   ├── src/components/ # UI components
│   └── src/server/     # tRPC routers
├── packages/
│   ├── db/             # Database schema (Drizzle)
│   └── ai/             # OpenRouter + RAG service
```

## Development

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Build all packages
npm run lint         # Lint codebase
npm run db:push      # Push schema to database
npm run db:seed      # Seed demo data
npm run db:studio    # Open Drizzle Studio
npm run stop         # Stop PostgreSQL container
```

## Contributing

1. Follow existing code patterns
2. Keep functions small and type-safe
3. Run `npm run lint` and `npm run check-types` before committing

See [AGENTS.md](./AGENTS.md) for detailed coding guidelines.

## License

[GNU Affero General Public License v3.0](./LICENSE)

---

<p align="center">
  <strong>Built for educators, powered by AI.</strong>
</p>
