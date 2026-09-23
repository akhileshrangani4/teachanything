/**
 * Invalid-index detection, run after every migration (see
 * scripts/check-index-health.ts).
 *
 * A `CREATE INDEX CONCURRENTLY` that gets cancelled (statement_timeout, a
 * dropped connection) leaves the index behind with `indisvalid = false`. The
 * planner ignores it, so every query that needed it falls back to a sequential
 * scan, and nothing errors. Worse, `CREATE INDEX ... IF NOT EXISTS` treats the
 * broken index as existing, so re-running migrations never repairs it. That is
 * how file_chunks_embedding_idx sat unused for months and exhausted the
 * Supabase disk IO budget in Sep 2026.
 */

export interface InvalidIndex {
  schema: string;
  table: string;
  index: string;
  definition: string;
}

/** Only `public`: the Supabase-managed schemas are not ours to fix. */
export const INVALID_INDEXES_QUERY = `
  SELECT n.nspname AS "schema",
         t.relname AS "table",
         c.relname AS "index",
         pg_get_indexdef(i.indexrelid) AS "definition"
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  JOIN pg_class t ON t.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT i.indisvalid AND n.nspname = 'public'
  ORDER BY 1, 2, 3
`;

/** Rewrites `CREATE [UNIQUE] INDEX name` into its CONCURRENTLY form. */
export function toConcurrentDefinition(definition: string): string {
  return definition.replace(
    /^CREATE (UNIQUE )?INDEX /,
    (_, unique: string | undefined) =>
      `CREATE ${unique ?? ""}INDEX CONCURRENTLY `,
  );
}

/** Human-readable failure report, or null when every index is valid. */
export function formatInvalidIndexReport(
  indexes: InvalidIndex[],
): string | null {
  if (indexes.length === 0) return null;

  const fixes = indexes.map(
    (ix) =>
      `  -- ${ix.table}.${ix.index}\n` +
      `  DROP INDEX CONCURRENTLY ${ix.schema}.${ix.index};\n` +
      `  ${toConcurrentDefinition(ix.definition)};`,
  );

  return [
    `Found ${indexes.length} invalid index(es). Postgres ignores these, so the queries that need them seq-scan.`,
    "IF NOT EXISTS skips an invalid index, so re-running migrations will not repair it.",
    "Rebuild each over a session connection (port 5432, not the 6543 pooler) with",
    "SET statement_timeout = 0, one statement at a time (CONCURRENTLY cannot run in a transaction):",
    "",
    ...fixes,
  ].join("\n");
}
