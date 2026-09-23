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
--   - This script runs automatically when you run: npm run db:push or npm run db:migrate
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

-- Full-text (tsvector) expression index on file_chunks.content for hybrid
-- retrieval. Zero-downtime, no stored column / table rewrite.
-- CONCURRENTLY is safe here: this file runs outside a transaction.
CREATE INDEX CONCURRENTLY IF NOT EXISTS file_chunks_fts_gin
  ON file_chunks USING gin (to_tsvector('english', content));

-- Hybrid retrieval no longer has a trigram retriever (#516), so nothing reads
-- this index. It only cost write IO on every chunk insert. Dropped here so
-- every environment converges, and a no-op once it is gone.
-- (No semicolons in comments: setup-extensions.ts splits this file on them.)
DROP INDEX CONCURRENTLY IF EXISTS file_chunks_content_trgm_gin;
