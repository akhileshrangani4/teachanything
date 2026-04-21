-- ============================================================================
-- Row-Level Security (RLS) Setup for File-Related Tables
-- ============================================================================
-- 
-- PURPOSE:
--   Disables RLS on file-related tables since authorization is handled at
--   the application layer (tRPC) rather than at the database level.
-- 
-- TABLES AFFECTED:
--   - user_files: Centralized file storage
--   - file_chunks: File chunks with embeddings for RAG
--   - chatbot_file_associations: Many-to-many relationship between chatbots and files
--   - crawl_sources: Web crawler source URLs and crawl configuration
--   - crawled_pages: Individual pages discovered and processed by the crawler
-- 
-- WHY DISABLE RLS?
--   - We use Better Auth (not Supabase Auth) with direct PostgreSQL connections
--   - Authorization is enforced in tRPC procedures by checking ctx.session.user.id
--   - This approach is simpler and more appropriate for our architecture
--   - The application layer already ensures users can only access their own files
-- 
-- INSTRUCTIONS:
--   - Run via: npm run db:setup-rls
--   - Or manually run in Supabase SQL Editor
--   - IMPORTANT: Run this AFTER running migrations (npm run db:push)
-- 
-- ============================================================================

-- ============================================================================
-- Step 1: Clean up any existing policies on user_files table
-- ============================================================================
-- These policies are not needed when RLS is disabled, so we clean them up
DROP POLICY IF EXISTS "Allow all operations for application" ON "user_files";
DROP POLICY IF EXISTS "Allow postgres role to manage files" ON "user_files";
DROP POLICY IF EXISTS "Allow service role to manage files" ON "user_files";
DROP POLICY IF EXISTS "Allow authenticated users to manage their files" ON "user_files";

-- ============================================================================
-- Step 2: Disable RLS on all file-related tables
-- ============================================================================
-- This allows the application to perform operations without RLS restrictions
-- Security is maintained at the application layer (tRPC)
ALTER TABLE "user_files" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "file_chunks" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "chatbot_file_associations" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "crawl_sources" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "crawled_pages" DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Note: The application layer (tRPC procedures) already validates that
-- users can only access/modify their own files by checking ctx.session.user.id
-- So disabling RLS is safe and appropriate for this setup.
-- ============================================================================

