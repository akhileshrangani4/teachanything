# Contributing to Teach Anything

Thanks for your interest in contributing! This guide covers setup and workflow expectations.

> **Using an AI coding assistant?** Read [AGENTS.md](./AGENTS.md) for agent-specific coding standards and architecture guidance.

## Development Setup

### Prerequisites

- Node.js >= 20
- npm
- Docker (for PostgreSQL)

### 1. Clone and Install

```bash
git clone https://github.com/akhileshrangani4/teachanything.git
cd teachanything
npm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

### 3. Configure Environment

```bash
cp apps/web/.env.example apps/web/.env
```

Edit `apps/web/.env` and add your API keys:

- `OPENROUTER_API_KEY` — get from [openrouter.ai](https://openrouter.ai/)
- `OPENAI_API_KEY` — get from [platform.openai.com](https://platform.openai.com/) (required for embeddings/RAG)

The other required values (DATABASE_URL, BETTER_AUTH_SECRET, etc.) already have working defaults for local Docker. See [SETUP.md](./SETUP.md) for details.

### 4. Set Up Database & Seed Demo Data

```bash
npm run db:push    # Push schema (auto-enables pgvector)
npm run db:seed    # Create demo users, chatbots, and files
```

The seed creates an admin, a professor with 3 chatbots and 6 sample files (PDF, DOCX, TXT, MD, JSON, CSV), and a pending user for testing the approval workflow. Credentials are printed to the console.

### 5. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000 and login with the credentials printed by `db:seed`.

## Common Commands

```bash
# Development
npm run dev              # Start dev server (port 3000)
npm run build            # Build all packages

# Quality (required before PRs)
npm run lint             # Lint codebase
npm run check-types      # TypeScript type check

# Database
npm run db:push          # Push schema to database
npm run db:generate      # Generate migrations
npm run db:migrate       # Run migrations
npm run db:studio        # Open Drizzle Studio GUI

# Infrastructure
npm run stop             # Stop PostgreSQL container
```

## Repository Structure

```
teachanything/
├── apps/
│   └── web/                  # Next.js 16 application
│       └── src/
│           ├── app/          # App Router pages & API routes
│           ├── server/       # tRPC routers & middleware
│           ├── lib/          # Utilities (auth, email, rate-limit, qstash)
│           ├── components/   # React components (Shadcn UI)
│           └── hooks/        # Custom React hooks
├── packages/
│   ├── db/                   # Database package (Drizzle schema)
│   └── ai/                   # AI package (LLM client, RAG pipeline)
```

## Pull Request Workflow

### 1. Pick an Issue

- Find an open issue or file a new one
- Comment on the issue to indicate you're working on it
- Branch from `main`

### 2. Branch Naming

Use descriptive branch names:

```
feat/add-ocr-support
fix/scanned-pdf-fallback
refactor/analytics-queries
```

### 3. Build Your Feature

- Read existing code before writing new code — follow established patterns
- Follow the coding standards in [AGENTS.md](./AGENTS.md)
- Keep functions short and single-purpose
- Use strict TypeScript — no `any`
- Add Zod validation on all tRPC inputs
- Add ownership checks on protected resources

### 4. Run Quality Checks

Both must pass before opening a PR:

```bash
npm run lint
npm run check-types
```

Also verify:

- [ ] No `console.log` statements (use `lib/logger.ts`)
- [ ] Backwards-compatible changes when possible

### 5. Open a Pull Request

#### PR Title Format

PR titles **must** use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(scope): description
```

**Types:**
| Type | When to Use | Release |
|------|-------------|---------|
| `feat` | New feature | Minor |
| `fix` | Bug fix | Patch |
| `refactor` | Code restructuring (no behavior change) | Patch |
| `perf` | Performance improvement | Patch |
| `docs` | Documentation only | None |
| `test` | Adding/updating tests | None |
| `chore` | Maintenance, dependencies | None |

**Scopes:** `files`, `ai`, `chat`, `auth`, `admin`, `analytics`, `crawler`, `web`, `db`

**Examples:**

- `feat(files): add OCR support for image uploads`
- `fix(analytics): calculate actual RAG usage percentage`
- `feat(crawler): add web crawler for site content ingestion`
- `refactor(chat): extract streaming logic to separate function`

For breaking changes, add `!` after the scope: `feat(api)!: change response format`

#### PR Description

Use this structure:

```markdown
## Summary

Brief description of what this PR does and why.

- Bullet points for key changes
- Reference the issue: Closes #123

## Changes

- What was added/modified/removed
- Any architectural decisions made and why

## Library Choices (if applicable)

If you introduced new dependencies, briefly explain:

- What you chose and why
- What alternatives you considered
- Maintenance status of the chosen library

## Screenshots (if visual changes)

Before/after screenshots or screen recordings for UI changes.

## Test Plan

- [ ] How to test the changes
- [ ] Edge cases considered
- [ ] What was manually verified
```

### PR Checklist

Before requesting review, verify:

- [ ] PR title follows Conventional Commit format
- [ ] Linked to an issue (or context provided)
- [ ] `npm run lint` passes
- [ ] `npm run check-types` passes
- [ ] No `console.log` statements
- [ ] Zod validation on all new tRPC inputs
- [ ] Ownership checks on protected resources
- [ ] Screenshots attached for visual changes
- [ ] New dependencies justified in PR description
- [ ] Database migrations generated (`npm run db:generate`) if schema changed

## Database Changes

If your PR modifies `packages/db/src/schema.ts`:

1. Make your schema changes
2. Generate a migration: `npm run db:generate`
3. Test the migration: `npm run db:migrate`
4. Include the generated migration file in your PR

## Adding Dependencies

- Avoid adding new dependencies unless necessary
- If you must add one, justify it in your PR description
- Check that the package is actively maintained (recent releases, open issues addressed)
- Prefer packages with TypeScript support

## Code Style Quick Reference

| Item                  | Convention                            |
| --------------------- | ------------------------------------- |
| Files/directories     | `kebab-case`                          |
| Components/Classes    | `PascalCase`                          |
| Variables/functions   | `camelCase`                           |
| Environment variables | `UPPER_SNAKE_CASE`                    |
| Booleans              | Prefix with `is`/`has`/`can`/`should` |

For the full coding standards, see [AGENTS.md](./AGENTS.md).

## Related Documentation

| Document                 | Purpose                                  |
| ------------------------ | ---------------------------------------- |
| [AGENTS.md](./AGENTS.md) | Coding standards, architecture, patterns |
| [SETUP.md](./SETUP.md)   | Detailed setup and configuration         |
| [README.md](./README.md) | Project overview                         |

## Questions?

Open an issue or reach out to the maintainers.

Thanks for contributing!
