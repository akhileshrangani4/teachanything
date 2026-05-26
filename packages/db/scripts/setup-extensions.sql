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

-- Enable pg_trgm extension for trigram indexes used by text search
-- This is required for the messages.content gin_trgm_ops index
CREATE EXTENSION IF NOT EXISTS pg_trgm;
