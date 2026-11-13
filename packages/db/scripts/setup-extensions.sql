-- ============================================================================
-- Database Extensions Setup
-- ============================================================================
-- 
-- This script enables required PostgreSQL extensions for the application.
-- 
-- Extensions enabled:
--   - vector (pgvector): Required for storing and querying vector embeddings
--                        Used in file_chunks.embedding column for RAG functionality
--
-- INSTRUCTIONS:
--   - This script runs automatically BEFORE db:push and db:migrate, because the
--     schema needs these extensions. It must not touch any table: on a new
--     database none exist yet. Anything that does belongs in setup-indexes.sql.
--   - Or run manually via: npm run db:setup-extensions
--   - Or manually in Supabase SQL Editor
--
-- ============================================================================

-- Enable pgvector extension for vector similarity search
-- This is required for the RAG (Retrieval Augmented Generation) functionality
-- to store and query embeddings in the file_chunks table
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm for trigram matching. Still required by the
-- messages_content_trgm_idx index (conversation search in analytics).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
