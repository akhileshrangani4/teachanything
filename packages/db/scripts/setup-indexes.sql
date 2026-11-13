-- ============================================================================
-- Indexes Outside the Drizzle Schema
-- ============================================================================
--
-- Runs automatically AFTER db:push and db:migrate, because these need the
-- tables to exist. Also runnable via: npm run db:setup-indexes
--
-- ============================================================================

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
