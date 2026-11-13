# Database Setup Scripts

This directory contains scripts for setting up the database.

## Scripts Overview

### 1. Extensions Setup (`scripts/setup-extensions.sql` + `scripts/setup-extensions.ts`)

**Purpose**: Enable required PostgreSQL extensions

**What it does**:

- Enables `vector` (pgvector) extension for storing embeddings
- Required for RAG functionality (file_chunks.embedding column)

**Usage**:

```bash
npm run db:setup-extensions
```

**Auto-run**: Automatically runs before `db:push` and `db:migrate`

---

### 2. RLS Setup (`scripts/setup-rls-policies.sql` + `scripts/setup-rls-policies.ts`)

**Purpose**: Disable Row-Level Security on file-related tables

**What it does**:

- Drops existing policies on `user_files` table
- Disables RLS on:
  - `user_files` (centralized file storage)
  - `file_chunks` (file chunks with embeddings)
  - `chatbot_file_associations` (chatbot-file relationships)

**Why disable RLS?**

- We use Better Auth (not Supabase Auth) with direct PostgreSQL connections
- Authorization is enforced at application layer (tRPC) by checking `ctx.session.user.id`
- Simpler and more appropriate for our architecture

**Usage**:

```bash
npm run db:setup-rls
```

**Important**: Run this AFTER running migrations (`npm run db:push`)

---

### 3. Schema Drift Check (`scripts/check-schema-drift.ts` + `src/schema-drift.ts`)

**Purpose**: Fail when the live database is missing a table or column that `src/schema.ts` declares

**What it does**:

- Reads every column of every base table in `public` from `information_schema`, inside a read-only transaction
- Lists each missing table and each missing `table.column`, and exits 1 if there are any
- Ignores tables and columns the database has but the code does not declare

**Usage**:

```bash
npm run db:check-drift
```

**Auto-run**: The release workflow runs it after `db:migrate` and before deploying to production

---

## Setup Workflow

For a fresh database setup:

1. **Enable extensions** (auto-runs with push/migrate):

   ```bash
   npm run db:push
   ```

2. **Disable RLS on file tables**:
   ```bash
   npm run db:setup-rls
   ```

That's it! The database is now ready.

---

## File Structure

```
packages/db/
├── scripts/
│   ├── setup-extensions.sql      # SQL for enabling extensions
│   ├── setup-extensions.ts       # TypeScript script to run SQL
│   ├── setup-rls-policies.sql    # SQL for RLS setup
│   ├── setup-rls-policies.ts     # TypeScript script to run SQL
│   ├── create-admin.sql          # SQL for creating admin user
│   └── reset-db.ts               # TypeScript script to reset database
└── package.json                  # npm scripts
```

---

### 3. Create Admin User (`scripts/create-admin.sql`)

**Purpose**: Create an admin user account in the database

**What it does**:

- Creates a user record with 'admin' role and 'approved' status
- Creates an account record with password hash for authentication
- Uses Better Auth's credential provider

**Usage**:

1. Generate bcrypt hash: `node -e "const bcrypt=require('bcryptjs');bcrypt.hash('yourpassword',12).then(h=>console.log(h))"`
2. Edit `scripts/create-admin.sql` and replace placeholders
3. Run in Supabase SQL Editor

**Security**: Password is stored as bcrypt hash (never plain text!)

---

### 4. Reset Database (`scripts/reset-db.ts`)

**Purpose**: Completely reset the database (development only!)

**What it does**:

- Drops all tables (in reverse dependency order)
- Drops all custom types (enums)
- Provides next steps for recreating schema

**⚠️ WARNING**: This will DELETE ALL DATA! Do not use in production!

**Usage**:

```bash
npm run db:reset
```

**After running**:

1. Run: `npm run db:push` (to recreate schema)
2. Run: `npm run db:setup-rls` (to disable RLS)
3. Create admin user if needed

---

## Notes

- All scripts load environment variables from `apps/web/.env`
- All scripts require `DATABASE_URL` environment variable
- Most scripts are idempotent (safe to run multiple times)
- `reset-db.ts` is NOT idempotent - it deletes everything!
- See individual script files for detailed documentation
