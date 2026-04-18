-- Preflight: fail fast if duplicates exist (run dedup-before-constraints.ts first)
DO $$
DECLARE
  chunk_dupes integer;
  assoc_dupes integer;
BEGIN
  SELECT count(*) INTO chunk_dupes FROM (
    SELECT file_id, chunk_index FROM file_chunks GROUP BY file_id, chunk_index HAVING count(*) > 1
  ) sub;
  SELECT count(*) INTO assoc_dupes FROM (
    SELECT chatbot_id, file_id FROM chatbot_file_associations GROUP BY chatbot_id, file_id HAVING count(*) > 1
  ) sub;
  IF chunk_dupes > 0 OR assoc_dupes > 0 THEN
    RAISE EXCEPTION 'Duplicate rows found (% chunk groups, % association groups). Run: npx tsx packages/db/scripts/dedup-before-constraints.ts', chunk_dupes, assoc_dupes;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chatbot_file_associations_chatbot_id_file_id_idx" ON "chatbot_file_associations" USING btree ("chatbot_id","file_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_chunks_embedding_idx" ON "file_chunks" USING hnsw ("embedding" vector_cosine_ops) WITH (m=24,ef_construction=128);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_chunks_file_id_idx" ON "file_chunks" USING btree ("file_id");--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'file_chunks_file_id_chunk_index_unique' AND table_name = 'file_chunks') THEN
    ALTER TABLE "file_chunks" ADD CONSTRAINT "file_chunks_file_id_chunk_index_unique" UNIQUE("file_id","chunk_index");
  END IF;
END $$;