CREATE UNIQUE INDEX "chatbot_file_associations_chatbot_id_file_id_idx" ON "chatbot_file_associations" USING btree ("chatbot_id","file_id");--> statement-breakpoint
CREATE INDEX "file_chunks_embedding_idx" ON "file_chunks" USING hnsw ("embedding" vector_cosine_ops) WITH (m=24,ef_construction=128);--> statement-breakpoint
CREATE INDEX "file_chunks_file_id_idx" ON "file_chunks" USING btree ("file_id");--> statement-breakpoint
ALTER TABLE "file_chunks" ADD CONSTRAINT "file_chunks_file_id_chunk_index_unique" UNIQUE("file_id","chunk_index");