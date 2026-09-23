import { describe, it, expect } from "@jest/globals";
import {
  formatInvalidIndexReport,
  toConcurrentDefinition,
  INVALID_INDEXES_QUERY,
} from "../index-health";

const hnsw = {
  schema: "public",
  table: "file_chunks",
  index: "file_chunks_embedding_idx",
  definition:
    "CREATE INDEX file_chunks_embedding_idx ON public.file_chunks USING hnsw (embedding vector_cosine_ops) WITH (m='24', ef_construction='128')",
};

describe("toConcurrentDefinition", () => {
  it("inserts CONCURRENTLY into a plain index definition", () => {
    expect(toConcurrentDefinition(hnsw.definition)).toBe(
      "CREATE INDEX CONCURRENTLY file_chunks_embedding_idx ON public.file_chunks USING hnsw (embedding vector_cosine_ops) WITH (m='24', ef_construction='128')",
    );
  });

  it("keeps UNIQUE", () => {
    expect(
      toConcurrentDefinition(
        "CREATE UNIQUE INDEX a_idx ON public.t USING btree (x)",
      ),
    ).toBe(
      "CREATE UNIQUE INDEX CONCURRENTLY a_idx ON public.t USING btree (x)",
    );
  });
});

describe("formatInvalidIndexReport", () => {
  it("returns null when every index is valid", () => {
    expect(formatInvalidIndexReport([])).toBeNull();
  });

  it("names each invalid index with a drop-and-rebuild fix", () => {
    const report = formatInvalidIndexReport([hnsw]);

    expect(report).toContain("Found 1 invalid index(es)");
    expect(report).toContain("IF NOT EXISTS skips an invalid index");
    expect(report).toContain(
      "DROP INDEX CONCURRENTLY public.file_chunks_embedding_idx;",
    );
    expect(report).toContain(
      "CREATE INDEX CONCURRENTLY file_chunks_embedding_idx ON public.file_chunks",
    );
    expect(report).toContain("statement_timeout = 0");
  });

  it("lists every invalid index", () => {
    const report = formatInvalidIndexReport([
      hnsw,
      {
        ...hnsw,
        index: "other_idx",
        definition: "CREATE INDEX other_idx ON public.t USING btree (x)",
      },
    ]);
    expect(report).toContain("Found 2 invalid index(es)");
    expect(report).toContain("DROP INDEX CONCURRENTLY public.other_idx;");
  });
});

describe("INVALID_INDEXES_QUERY", () => {
  it("only looks at invalid indexes in the public schema", () => {
    expect(INVALID_INDEXES_QUERY).toContain("NOT i.indisvalid");
    expect(INVALID_INDEXES_QUERY).toContain("n.nspname = 'public'");
  });
});
