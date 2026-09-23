/**
 * The vector retriever must run with pgvector's iterative scan on, or HNSW
 * returns far fewer rows than requested for chatbots that hold a small share
 * of all chunks (21 of 60 on the largest chatbot in Sep 2026). SET LOCAL only
 * works inside a transaction, and only for queries that run after it, so both
 * are pinned here with a fake db that records the call order.
 */
import { describe, it, expect } from "@jest/globals";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { bySimilarityDesc, hybridSearch } from "@/server/hybrid-search";

type Db = Parameters<typeof hybridSearch>[0]["db"];

/** A drizzle-ish query builder that resolves to `rows` when awaited. */
function builder(log: string[], label: string, rows: unknown[]) {
  const b: Record<string, unknown> = {};
  for (const m of ["from", "innerJoin", "where", "orderBy", "limit"]) {
    b[m] = () => b;
  }
  b.then = (resolve: (v: unknown) => void) => {
    log.push(label);
    resolve(rows);
  };
  return b;
}

function fakeDb(vectorRows: Array<{ chunkId: string; similarity: number }>) {
  const log: string[] = [];
  const dialect = new PgDialect();
  const db = {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      log.push("BEGIN");
      const tx = {
        execute: async (q: SQL) => {
          log.push(dialect.sqlToQuery(q).sql);
        },
        select: () => builder(log, "vector query", vectorRows),
      };
      const result = await fn(tx);
      log.push("COMMIT");
      return result;
    },
    // Outside the transaction: the FTS leg, then the hydrate query.
    select: (fields: Record<string, unknown>) =>
      "content" in fields
        ? builder(log, "hydrate", [])
        : builder(log, "fts query", []),
  } as unknown as Db;
  return { db, log };
}

describe("bySimilarityDesc", () => {
  it("re-sorts relaxed_order output, highest similarity first", () => {
    expect(
      bySimilarityDesc([
        { chunkId: "b", similarity: 0.71 },
        { chunkId: "a", similarity: 0.84 },
        { chunkId: "c", similarity: 0.52 },
      ]).map((r) => r.chunkId),
    ).toEqual(["a", "b", "c"]);
  });

  it("does not mutate its input", () => {
    const rows = [
      { chunkId: "b", similarity: 0.1 },
      { chunkId: "a", similarity: 0.9 },
    ];
    bySimilarityDesc(rows);
    expect(rows[0]!.chunkId).toBe("b");
  });
});

describe("hybridSearch vector retriever", () => {
  it("turns on iterative scan inside the transaction, before the vector query", async () => {
    const { db, log } = fakeDb([{ chunkId: "c1", similarity: 0.9 }]);
    await hybridSearch({
      db,
      fileIds: ["f1"],
      query: "photosynthesis",
      queryEmbedding: [0.1, 0.2],
      limit: 6,
    });

    const begin = log.indexOf("BEGIN");
    const setLocal = log.indexOf(
      "SET LOCAL hnsw.iterative_scan = relaxed_order",
    );
    const vector = log.indexOf("vector query");
    const commit = log.indexOf("COMMIT");
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(setLocal).toBeGreaterThan(begin);
    expect(vector).toBeGreaterThan(setLocal);
    expect(commit).toBeGreaterThan(vector);
  });
});
