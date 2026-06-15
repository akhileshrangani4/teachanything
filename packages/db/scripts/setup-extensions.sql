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

-- Enable pg_trgm for trigram (fuzzy / exact-substring) lexical search.
-- Used alongside tsvector full-text search in hybrid retrieval (issue #271).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Lexical search indexes on file_chunks.content for hybrid retrieval.
-- CONCURRENTLY is safe here: this file runs outside a transaction.
-- Full-text (tsvector) expression index — zero-downtime, no stored column / table rewrite.
CREATE INDEX CONCURRENTLY IF NOT EXISTS file_chunks_fts_gin
  ON file_chunks USING gin (to_tsvector('english', content));

-- Trigram index for fuzzy / exact-substring matching.
CREATE INDEX CONCURRENTLY IF NOT EXISTS file_chunks_content_trgm_gin
  ON file_chunks USING gin (content gin_trgm_ops);
