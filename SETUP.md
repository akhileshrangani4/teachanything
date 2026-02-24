# Teach Anything - Complete Setup Guide

## Overview

Production-ready AI chatbot platform built with Next.js 16, tRPC, Better Auth, and OpenRouter. This guide covers complete setup from installation to deployment.

---

## Quick Local Setup (5 minutes)

Get the app running locally with just Docker, an OpenRouter API key, and an OpenAI API key.

### What works without external services

| Feature | Requirement |
|---------|------------|
| Auth, login, admin panel | Docker only |
| Chat with AI + RAG | Docker + OpenRouter key + OpenAI key |
| File upload + processing | Docker + OpenAI key (files stored locally) |
| Emails | Logged to console (no Resend needed) |
| Rate limiting | Disabled locally (no Redis needed) |
| Async file processing | Runs inline in dev (no QStash needed) |

File uploads use a local filesystem fallback (`./uploads/`) when Supabase is not configured.

### 1. Start PostgreSQL

```bash
docker compose up -d
```

This starts PostgreSQL on port **5433** (to avoid conflicts with any local PostgreSQL on the default 5432).

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp apps/web/.env.example apps/web/.env
```

Edit `apps/web/.env` — set these required values:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/teachanything
BETTER_AUTH_SECRET=your_random_32_char_secret  # Generate: openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000
OPENROUTER_API_KEY=sk-or-v1-...               # Get from openrouter.ai
OPENAI_API_KEY=sk-...                         # Get from platform.openai.com (for embeddings)
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_EMAILS=admin@example.com
```

### 4. Push Schema & Seed Demo Data

```bash
npm run db:push    # Push schema (auto-enables pgvector)
npm run db:seed    # Create demo users, chatbots, and files
```

The seed script creates:
- **Admin** — email from `ADMIN_EMAILS`, password `admin123`
- **Professor** (`professor@demo.edu` / `demo123`) — 3 chatbots with sample files in every supported format (PDF, DOCX, TXT, Markdown, JSON, CSV), pre-generated embeddings for RAG
- **Pending user** (`student@demo.edu` / `demo123`) — for testing the admin approval workflow

### 5. Start Development

```bash
npm run dev
```

Visit http://localhost:3000 and login with your seeded admin credentials.

---

## Full Setup (All Services)

### Prerequisites

Create accounts and obtain API keys from:

- **Supabase** (https://supabase.com/) - PostgreSQL + Storage
- **OpenRouter** (https://openrouter.ai/) - AI models
- **OpenAI** (https://platform.openai.com/) - Embeddings API
- **Resend** (https://resend.com/) - Email service
- **Upstash** (https://upstash.com/) - Redis + QStash

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create `apps/web/.env`:

```bash
# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST].supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI/OpenRouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENAI_API_KEY=sk-...  # For embeddings

# Better Auth
BETTER_AUTH_SECRET=your_random_32_char_secret  # Generate: openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000

# Resend Email
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_WEBHOOK_SECRET=whsec_your_webhook_secret

# Upstash QStash (Async Jobs)
QSTASH_TOKEN=your_qstash_token
QSTASH_URL=https://qstash.upstash.io
QSTASH_CURRENT_SIGNING_KEY=your_current_signing_key
QSTASH_NEXT_SIGNING_KEY=your_next_signing_key

# Upstash Redis (Rate Limiting)
UPSTASH_REDIS_REST_URL=https://[region].upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_MAX_FILE_SIZE_MB=50
ALLOWED_EMAIL_DOMAINS=.edu,.ac.in,.edu.in
ADMIN_EMAILS=admin@yourdomain.com
```

### 3. Database Setup

#### Enable pgvector Extension

The extension setup runs automatically when you run `npm run db:push` or `npm run db:migrate`.

To run manually:

```bash
npm run db:setup-extensions
```

Or manually in Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

#### Run Migrations

```bash
npm run db:push
```

This will automatically:

1. Enable required extensions (pgvector)
2. Push the database schema

#### Setup Row-Level Security (RLS) Policies

**Important**: After running migrations, you must set up RLS for file-related tables (`user_files`, `file_chunks`, `chatbot_file_associations`) to allow file operations.

Run the RLS setup script:

```bash
npm run db:setup-rls
```

Or manually run the SQL script in Supabase SQL Editor:

```sql
-- See packages/db/scripts/setup-rls-policies.sql
```

This disables RLS on file-related tables since authorization is handled at the application layer (tRPC).

#### Create First Admin User

Use the provided script for a complete admin setup:

1. Generate a bcrypt hash for your password:

```bash
node -e "const bcrypt=require('bcryptjs');bcrypt.hash('yourpassword',12).then(h=>console.log(h))"
```

2. Edit `packages/db/scripts/create-admin.sql` and replace:
   - `email_var`: Your admin email
   - `name_var`: Your admin name
   - `password_hash_var`: The bcrypt hash from step 1

3. Run the script in Supabase SQL Editor

**Alternative** (simpler but less secure - for development only):

```sql
INSERT INTO "user" (id, email, name, role, status, email_verified, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@yourdomain.com',  -- Change this
  'Admin User',
  'admin',
  'approved',
  true,
  NOW(),
  NOW()
);
```

### 4. Supabase Storage

1. Go to Supabase Dashboard → Storage
2. Create bucket: `chatbot-files`
3. Set as **Private**

### 5. Start Development

```bash
npm run dev
```

Visit: http://localhost:3000

---

## Architecture

### Tech Stack

**Core**: Next.js 16 · TypeScript · Turborepo · tRPC  
**Database**: PostgreSQL (Supabase) · Drizzle ORM · pgvector  
**Auth**: Better Auth with approval workflow  
**AI**: OpenRouter (4 models) · Vercel AI SDK · LangChain  
**Infrastructure**: Upstash Redis · QStash · Resend  
**UI**: Shadcn UI · Tailwind CSS

### Project Structure

```
teachanything/
├── apps/web/              # Next.js application
│   ├── src/app/          # Pages & API routes
│   ├── src/components/   # UI components
│   ├── src/lib/          # Utilities
│   └── src/server/       # tRPC routers
├── packages/
│   ├── db/               # Database schema
│   └── ai/               # OpenRouter + RAG
```

---

## Authentication & Approval

### How It Works

**Registration:**

1. User registers → status set to 'pending'
2. Database hook validates email domain
3. Admin receives notification email
4. User sees "Awaiting approval" message

**Login:**

1. User enters credentials
2. Better Auth validates
3. Database hook checks status
4. Blocks if pending/rejected
5. Allows if approved

**Approval:**

1. Admin views pending users at `/admin`
2. Approves or rejects
3. User receives email notification
4. Approved users can login

### Domain Validation (Optional)

Restrict registration to specific domains:

```sql
INSERT INTO "approved_domains" (domain, created_at)
VALUES
  ('yourdomain.com', NOW()),
  ('university.edu', NOW());
```

If no domains configured → all emails allowed.

---

## File Upload & Processing

### Upload Flow

1. User uploads file (PDF, Word, TXT, etc.)
2. File stored in Supabase Storage
3. Metadata saved to database
4. QStash job triggered
5. File extracted and chunked
6. Embeddings generated (OpenAI)
7. Stored in database with pgvector
8. Status updated to 'completed'

### Supported Types

- PDF (pdf-parse)
- Word Documents (mammoth)
- Plain Text
- Markdown
- JSON
- CSV

---

## Chat & RAG System

### How RAG Works

1. User sends message
2. Generate embedding for query
3. pgvector finds top 5 similar chunks
4. Relevant context injected into prompt
5. OpenRouter generates response
6. Sources cited in metadata

### Configuration

- **Chunk size**: 1000 characters
- **Overlap**: 200 characters
- **Similarity search**: pgvector cosine distance
- **Top K**: 5 chunks
- **Models**: Llama 3.3 70B, Mistral Large, Qwen 2.5 72B, GPT-OSS 120B

---

## API Reference (tRPC)

### Auth Router

- `getStatus` - Current user status
- `checkApprovalStatus` - Check approval

### Chatbot Router

- `list` - Get user's chatbots
- `create` - Create new chatbot
- `update` - Update settings
- `delete` - Delete chatbot
- `get` - Get chatbot by ID
- `getByShareToken` - Get by share token
- `generateShareToken` - Generate public link

### Chat Router

- `sendMessage` - Send message (protected)
- `sendSharedMessage` - Public chat (rate limited)
- `getHistory` - Conversation history
- `deleteConversation` - Delete session

### Files Router

- `upload` - Upload file
- `list` - List files
- `delete` - Delete file
- `getProcessingStatus` - Check status
- `getPreviewUrl` - Get signed URL

### Admin Router

- `getPendingUsers` - Users awaiting approval
- `approveUser` - Approve user
- `rejectUser` - Reject user
- `addDomain` - Add approved domain
- `removeDomain` - Remove domain
- `listDomains` - List domains

### Analytics Router

- `getChatbotStats` - Aggregate stats
- `getConversations` - Recent sessions
- `getMessageVolume` - Usage charts

---

## Testing

### Test Checklist

**Database:**

- [ ] pgvector enabled (auto-runs with `npm run db:push`)
- [ ] Migrations successful (`npm run db:push`)
- [ ] RLS disabled on file tables (`npm run db:setup-rls`)
- [ ] Admin user created (using `create-admin.sql`)
- [ ] Storage bucket created (`chatbot-files`, Private)

**Authentication:**

- [ ] User registration
- [ ] Admin notification email
- [ ] Pending user blocked from login
- [ ] Admin approval works
- [ ] Approved user can login

**Chatbot & Files:**

- [ ] Create chatbot
- [ ] Upload file
- [ ] File processes successfully
- [ ] Embeddings created

**Chat:**

- [ ] Send message with RAG
- [ ] Sources displayed
- [ ] Public chat works
- [ ] Rate limiting active

**Admin:**

- [ ] View pending users
- [ ] Approve/reject users
- [ ] Manage domains

---

## Production Deployment (Vercel)

### 1. Push to GitHub

```bash
git add .
git commit -m "Deploy Teach Anything"
git push origin main
```

### 2. Deploy to Vercel

1. Import GitHub repository
2. Set Root Directory: `apps/web`
3. Add all environment variables
4. Deploy!

### 3. Update Environment Variables

**IMPORTANT** - Change these for production:

- `BETTER_AUTH_URL` → `https://yourdomain.com`
- `NEXT_PUBLIC_APP_URL` → `https://yourdomain.com`
- `RESEND_FROM_EMAIL` → verified domain
- Regenerate `BETTER_AUTH_SECRET`

### 4. Production Database

1. Run migrations (auto-enables extensions):

   ```bash
   npm run db:push
   ```

2. Setup RLS for file tables:

   ```bash
   npm run db:setup-rls
   ```

3. Create admin user(s) using `packages/db/scripts/create-admin.sql`

4. Create Storage bucket: `chatbot-files` (Private)

### 5. Configure Domains

**Main App**: `yourdomain.com`  
**Admin**: `admin.yourdomain.com`

In Vercel:

1. Settings → Domains
2. Add both domains
3. Update DNS records

---

## Troubleshooting

### Build Fails

**Error**: Missing environment variables  
**Solution**: Create `apps/web/.env` with all required vars

### Database Migration Fails

**Error**: Cannot connect  
**Solution**:

1. Check `DATABASE_URL` is set correctly
2. Run `npm run db:setup-extensions` to enable pgvector
3. Verify database is accessible
4. Check that RLS is disabled: `npm run db:setup-rls`

### File Upload Fails

**Error**: Upload/processing fails  
**Solution**:

1. Verify Storage bucket exists: `chatbot-files` (Private)
2. Check `SUPABASE_SERVICE_ROLE_KEY` is set correctly
3. Ensure RLS is disabled: `npm run db:setup-rls`
4. Verify QStash credentials for async processing
5. Check Storage RLS policies allow service_role access

### AI Chat Not Working

**Error**: No response  
**Solution**:

1. Check `OPENROUTER_API_KEY`
2. Check `OPENAI_API_KEY` for embeddings
3. Verify model name in config
4. Check file chunks have embeddings

### Emails Not Sending

**Error**: No emails received  
**Solution**:

1. Verify `RESEND_API_KEY`
2. Check domain is verified in Resend
3. Check spam folder

---

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Database
npm run db:push           # Push schema (auto-runs extensions setup)
npm run db:generate       # Generate migrations
npm run db:setup-extensions  # Enable PostgreSQL extensions (pgvector)
npm run db:setup-rls      # Disable RLS on file tables (run after migrations)
npm run db:studio         # Open Drizzle Studio

# Infrastructure
npm run stop             # Stop PostgreSQL container

# Linting
npm run lint
```

---

## Features

### For Instructors

- Create chatbots for each course
- Upload course materials (PDF, Word, etc.)
- Get shareable links for students
- View conversation analytics
- Manage multiple chatbots

### For Students

- Access via shared link (no signup)
- Ask questions about materials
- Get AI-powered answers
- See source citations
- Completely anonymous

### For Admins

- Review user registrations
- Approve/reject users
- Manage email domains
- View system-wide stats

---

## Security

- Rate limiting on public endpoints
- Admin approval required
- Email domain restrictions
- Session-based authentication
- QStash signature verification
- Signed URLs for files

---

## Database Schema

### Core Tables

**user** - User accounts with role/status  
**session** - Better Auth sessions  
**chatbots** - Chatbot configurations  
**chatbot_files** - Uploaded files  
**file_chunks** - Text chunks with embeddings (pgvector)  
**conversations** - Chat sessions  
**messages** - Chat messages  
**analytics** - Usage tracking  
**approved_domains** - Email whitelist

---

## What's Included

### Backend

- All 6 tRPC routers implemented
- Better Auth with database hooks
- RAG system with semantic search
- Async file processing
- Email notifications
- Rate limiting
- Structured logging

### Frontend

- All pages implemented
- Full chat interface
- File upload with drag-drop
- Create chatbot dialog
- Admin dashboard
- Public chat sharing

---

## You're Ready!

The project is production-ready. Follow the setup steps above, and you'll have a fully functional AI chatbot platform running in minutes.

For support or questions, refer to this guide and the inline code documentation.

**Built with Next.js, tRPC, Better Auth, and OpenRouter**
