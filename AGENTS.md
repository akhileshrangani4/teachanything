# AGENTS.md

Comprehensive guidance for AI coding agents working in this repository.

## 1. Repository Structure

This is a Turborepo monorepo for the Teach Anything AI chatbot platform.

```
teachanything/
├── apps/
│   └── web/                      # Next.js 16 application
│       └── src/
│           ├── app/              # App Router pages & API routes
│           ├── server/
│           │   ├── trpc.ts       # tRPC setup, procedures, middleware
│           │   └── routers/      # API routers (auth, chatbot, chat, files, admin, analytics)
│           ├── lib/              # Utilities (auth, email, rate-limit, qstash, env, logger)
│           ├── components/       # React components (Shadcn UI based)
│           └── hooks/            # Custom React hooks
├── packages/
│   ├── db/                       # Database package
│   │   └── src/schema.ts         # Drizzle schema (all tables, relations, enums)
│   └── ai/                       # AI package
│       └── src/
│           ├── openrouter-client.ts  # LLM client with streaming
│           └── rag-service.ts        # RAG pipeline (chunking, embeddings)
├── turbo.json                    # Turborepo configuration
└── package.json                  # Workspace root
```

## 2. Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript 5.9
- **API**: tRPC 11 (end-to-end type-safe)
- **Database**: PostgreSQL + Drizzle ORM + pgvector
- **Auth**: Better Auth (email/password with admin approval workflow)
- **AI**: OpenRouter (LLMs) + OpenAI (embeddings) + Vercel AI SDK
- **UI**: Shadcn UI + Tailwind CSS
- **Infrastructure**: Upstash Redis (rate limiting), Upstash QStash (async jobs), Supabase Storage, Resend (email)

## 3. Development Commands

```bash
# Development
npm run dev              # Start dev server (port 3000)
npm run build            # Build all packages
npm run lint             # Lint codebase
npm run format           # Format with Prettier
npm run check-types      # TypeScript type check

# Testing
npm run test             # Run all tests
npm run test -- -- --coverage  # Run with coverage

# Database (Drizzle ORM)
npm run db:push          # Push schema to database
npm run db:generate      # Generate migrations
npm run db:migrate       # Run migrations
npm run db:studio        # Open Drizzle Studio GUI
```

## 4. Core Development Principles

1. **Read existing code first** — Understand patterns before adding new code
2. **Keep it simple** — Avoid over-engineering; solve the problem at hand
3. **Type safety** — Use strict TypeScript; avoid `any`
4. **Fail fast** — Explicit errors with clear messages; no silent failures or fallbacks
5. **DRY with caution** — Rule of Three: wait for 3 instances before abstracting

## 5. Naming Conventions

- **Files/directories**: kebab-case (`user-profile.tsx`, `auth-utils.ts`)
- **Components/Classes**: PascalCase (`UserProfile`, `ChatbotService`)
- **Variables/functions**: camelCase (`getUserById`, `isLoading`)
- **Environment variables**: UPPER_SNAKE_CASE (`DATABASE_URL`)
- **Booleans**: prefix with `is`/`has`/`can`/`should` (`isLoading`, `hasAccess`)

## 6. TypeScript Standards

- Use strict TypeScript throughout; avoid `any`
- Use `unknown` for truly uncertain types, `Record<string, unknown>` over `object`
- Prefer type inference where obvious; explicit types for function signatures
- Use discriminated unions for mutually exclusive states
- Leverage `as const` to preserve literal types
- Use `async/await` over raw Promises
- Prefer immutable patterns (`const`, spread operators, `.map()/.filter()`)
- Use Zod for runtime validation at API boundaries

## 7. tRPC API Development

All API logic lives in `apps/web/src/server/routers/`. Three procedure types:

```typescript
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../trpc";

export const myRouter = router({
  // No auth required
  publicEndpoint: publicProcedure.query(...),

  // Requires login + approved status (admins bypass approval check)
  userEndpoint: protectedProcedure.mutation(...),

  // Requires admin role
  adminEndpoint: adminProcedure.mutation(...),
});
```

Register new routers in `server/routers/_app.ts`.

### Input Validation

Always use Zod:

```typescript
.input(z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
}))
```

### Error Handling

Use TRPCError with appropriate codes:

```typescript
throw new TRPCError({ code: "NOT_FOUND", message: "Chatbot not found" });
throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid input" });
throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limited" });
```

### Authorization Pattern

Always verify ownership before returning/modifying data:

```typescript
const chatbot = await ctx.db.query.chatbots.findFirst({
  where: eq(chatbots.id, input.id),
});

if (!chatbot || chatbot.userId !== ctx.session.user.id) {
  throw new TRPCError({ code: "NOT_FOUND" });
}
```

## 8. Database (Drizzle ORM)

Schema lives in `packages/db/src/schema.ts`.

```typescript
import { db } from "@teachanything/db";
import { chatbots, userFiles } from "@teachanything/db/schema";
import { eq, and } from "drizzle-orm";

// Select
const results = await ctx.db.select().from(chatbots).where(eq(chatbots.userId, userId));

// Insert
await ctx.db.insert(chatbots).values({ ... });

// Update
await ctx.db.update(chatbots).set({ name: "New" }).where(eq(chatbots.id, id));

// Delete
await ctx.db.delete(chatbots).where(eq(chatbots.id, id));
```

### Schema Conventions

- `text` type for Better Auth IDs (nanoid), `uuid` for other tables
- `createdAt` timestamp on all tables, `updatedAt` where needed
- Cascading deletes on foreign keys (`onDelete: "cascade"`)
- JSONB `metadata` columns for flexible storage
- Vector embeddings: 1536 dimensions (OpenAI text-embedding-3-small)

## 9. Frontend Development

### React Patterns

- Functional components with hooks
- Use React Hook Form for forms with Zod validation
- State: `useState`/`useReducer` for local, Context for shared
- Minimize `useEffect`; derive state or memoize with `useMemo` instead
- Use tRPC hooks for data fetching with proper loading/error states
- Shadcn UI components from `components/ui/`

### Styling

- Tailwind CSS utility classes
- Use `gap` for spacing in flex/grid layouts
- Shadcn UI component variants
- CSS variables for theming (light/dark mode ready)

## 10. File Processing Flow

1. Client requests signed URL via `files.createUploadUrl`
2. Client uploads directly to Supabase Storage
3. Client calls `files.finalizeUpload`
4. Server publishes QStash job to `/api/jobs/process-file`
5. Job: download → extract text → chunk → embed → store in pgvector

## 11. Rate Limiting

Use limiters from `lib/rate-limit.ts`:

```typescript
import { chatbotCreationRateLimit } from "@/lib/rate-limit";

const { success } = await chatbotCreationRateLimit.limit(userId);
if (!success) {
  throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
}
```

## 12. Testing

### Strategy

- **Unit tests** for pure logic: validation, utilities, helpers, data transformations
- **Unit tests with mocks** for modules with external deps (Redis, database, APIs)
- Skip component/page tests unless they contain significant logic

### Test File Layout

- Tests live in `__tests__` directories mirroring the source structure
- File names: `<module>.test.ts` (e.g., `validation.test.ts`)
- Each package has its own Jest config and runs independently via Turborepo

```
apps/web/src/__tests__/
├── lib/
│   ├── validation.test.ts         # tests for src/lib/validation.ts
│   ├── password-rules.test.ts     # tests for src/lib/password/password-rules.ts
│   └── domain-validation.test.ts  # tests for src/lib/domain-validation.ts
└── server/
    ├── utils.test.ts              # tests for src/server/utils.ts
    └── files-validation.test.ts   # tests for src/server/routers/files/validation.ts
```

### ESM Import Pattern (Required)

All packages use `"type": "module"`. Jest globals are **not** auto-injected. Always import them explicitly:

```typescript
import { describe, it, expect } from "@jest/globals";
```

If you need `jest.fn()`, `jest.mock()`, or `jest.spyOn()`, also import `jest`:

```typescript
import { jest, describe, it, expect } from "@jest/globals";
```

### Mocking External Dependencies

When a module imports external services (Redis, env, database), mock them **before** importing the module under test using dynamic `await import()`:

```typescript
import { jest, describe, it, expect } from "@jest/globals";

// 1. Set up mocks FIRST
jest.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_MAX_FILE_SIZE_MB: "50" },
}));

// 2. THEN dynamically import the module under test
const { myFunction } = await import("@/lib/my-module");

// 3. Write tests as normal
describe("myFunction", () => {
  it("does the thing", () => {
    expect(myFunction("input")).toBe("output");
  });
});
```

### Mocking Guidelines

- **Only mock at system boundaries** — external APIs, databases, Redis, file system
- **Don't mock pure functions** — call them directly
- **Don't over-mock** — if you're mocking internal helpers, you're testing implementation details

### Running Tests

```bash
npm run test                       # All packages
npm run test -- -- --coverage      # With coverage
cd apps/web && npm test            # Single package
cd apps/web && npx jest --watch    # Watch mode (single package)
```

## 13. Git Workflow

**Commit format** (conventional commits):

```
<type>(scope): <description>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

Examples:

- `feat(chat): add message streaming support`
- `fix(auth): prevent duplicate session creation`
- `refactor(files): extract chunking logic to separate function`

## 14. Pre-Commit Checklist

Before committing:

```bash
npm run check-types    # Must pass
npm run lint           # Must pass
npm run test           # Must pass
```

- [ ] No `console.log` statements (use `lib/logger.ts`)
- [ ] Zod validation on all tRPC inputs
- [ ] Ownership checks on protected resources
- [ ] Tests for new utility/validation logic
- [ ] Backwards-compatible changes when possible

## 15. Agent Behavior

**Do not** (unless explicitly asked):

- Add/upgrade/remove dependencies
- Modify eslint, tsconfig, or tool configs
- Change database schema without migration plan

**Do**:

- Keep functions short and single-purpose (<20 statements ideal)
- Keep files focused (<300 lines ideal)
- Run lint and type-check before considering work complete
- Ask for clarification when requirements are ambiguous
- Be direct; flag problematic requirements immediately

## Key Files Reference

| File                                   | Purpose                                          |
| -------------------------------------- | ------------------------------------------------ |
| `apps/web/src/server/trpc.ts`          | tRPC initialization, procedures, auth middleware |
| `apps/web/src/server/routers/_app.ts`  | Root router combining all sub-routers            |
| `apps/web/src/lib/env.ts`              | Environment validation (Zod schema)              |
| `apps/web/src/lib/auth.ts`             | Better Auth configuration                        |
| `apps/web/src/lib/rate-limit.ts`       | Upstash rate limiters                            |
| `apps/web/src/lib/qstash.ts`           | QStash job publishing & verification             |
| `packages/db/src/schema.ts`            | Complete database schema                         |
| `packages/ai/src/openrouter-client.ts` | LLM client with streaming                        |
| `packages/ai/src/rag-service.ts`       | Text extraction, chunking, embeddings            |
