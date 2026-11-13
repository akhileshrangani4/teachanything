/**
 * Live-database schema drift detection, run by the release workflow after
 * migrations and before the production deploy (see
 * scripts/check-schema-drift.ts).
 *
 * Migrations are journal-tracked, so a migration that was marked applied but
 * never ran, or a column dropped by hand, leaves the database behind
 * `schema.ts` without anything failing until a query touches the missing
 * column in production. This compares what the code declares with what the
 * database actually has.
 *
 * Only existence is checked: every declared table and column must be present.
 * Columns the database has but the code does not declare are ignored, because
 * expand/contract migrations legitimately leave them behind for a release.
 */

import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";

/** The only schema the app's tables live in; Supabase owns the rest. */
export const DRIFT_SCHEMA = "public";

export interface DeclaredTable {
  table: string;
  columns: string[];
}

export interface DbColumn {
  table: string;
  column: string;
}

export interface SchemaDrift {
  /** Declared tables the database does not have at all. */
  missingTables: string[];
  /** `table.column` for each declared column missing from an existing table. */
  missingColumns: string[];
}

/**
 * Every column of every base table in `public`, in one read. Views are
 * excluded so a view that happens to share a table's name cannot mask a
 * missing table.
 */
export const DB_COLUMNS_QUERY = `
  SELECT c.table_name AS "table",
         c.column_name AS "column"
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema
   AND t.table_name = c.table_name
  WHERE c.table_schema = '${DRIFT_SCHEMA}'
    AND t.table_type = 'BASE TABLE'
  ORDER BY c.table_name, c.ordinal_position
`;

/**
 * The tables a schema module (`import * as schema`) declares, sorted by name.
 *
 * Throws on a table declared outside `public`: the query only reads `public`,
 * so such a table would always look missing, and silently skipping it would
 * hide real drift.
 */
export function collectDeclaredTables(
  schemaModule: Record<string, unknown>,
): DeclaredTable[] {
  const tables: DeclaredTable[] = [];

  for (const value of Object.values(schemaModule)) {
    if (!is(value, PgTable)) continue;

    const config = getTableConfig(value);
    if (config.schema !== undefined && config.schema !== DRIFT_SCHEMA) {
      throw new Error(
        `Table ${config.schema}.${config.name} is outside the "${DRIFT_SCHEMA}" schema, which the drift check does not read`,
      );
    }

    tables.push({
      table: config.name,
      columns: config.columns.map((column) => column.name),
    });
  }

  return tables.sort((a, b) => a.table.localeCompare(b.table));
}

/** What the code declares that the database lacks. Extra DB columns are ignored. */
export function diffSchema(
  declared: DeclaredTable[],
  dbColumns: DbColumn[],
): SchemaDrift {
  const columnsByTable = new Map<string, Set<string>>();
  for (const { table, column } of dbColumns) {
    const columns = columnsByTable.get(table) ?? new Set<string>();
    columns.add(column);
    columnsByTable.set(table, columns);
  }

  const missingTables: string[] = [];
  const missingColumns: string[] = [];

  for (const { table, columns } of declared) {
    const existing = columnsByTable.get(table);
    if (!existing) {
      missingTables.push(table);
      continue;
    }
    for (const column of columns) {
      if (!existing.has(column)) missingColumns.push(`${table}.${column}`);
    }
  }

  return { missingTables, missingColumns };
}

export function hasDrift(drift: SchemaDrift): boolean {
  return drift.missingTables.length > 0 || drift.missingColumns.length > 0;
}

/** Human-readable failure report, or null when nothing is missing. */
export function formatDriftReport(drift: SchemaDrift): string | null {
  if (!hasDrift(drift)) return null;

  const lines = [
    "The database is missing schema objects that packages/db/src/schema.ts declares.",
    "A migration was skipped, marked applied without running, or reverted by hand.",
  ];

  if (drift.missingTables.length > 0) {
    lines.push("", `Missing tables (${drift.missingTables.length}):`);
    lines.push(...drift.missingTables.map((table) => `  - ${table}`));
  }

  if (drift.missingColumns.length > 0) {
    lines.push("", `Missing columns (${drift.missingColumns.length}):`);
    lines.push(...drift.missingColumns.map((column) => `  - ${column}`));
  }

  return lines.join("\n");
}
