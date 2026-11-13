import { describe, it, expect } from "@jest/globals";
import { pgSchema, pgTable, text, uuid } from "drizzle-orm/pg-core";
import * as schema from "../schema";
import {
  DB_COLUMNS_QUERY,
  collectDeclaredTables,
  diffSchema,
  formatDriftReport,
  hasDrift,
  type DbColumn,
  type DeclaredTable,
} from "../schema-drift";

const declared: DeclaredTable[] = [
  { table: "account", columns: ["id", "user_id", "scope"] },
  { table: "chatbots", columns: ["id", "name"] },
];

function columnsOf(tables: DeclaredTable[]): DbColumn[] {
  return tables.flatMap(({ table, columns }) =>
    columns.map((column) => ({ table, column })),
  );
}

describe("diffSchema", () => {
  it("reports nothing when every declared table and column exists", () => {
    const drift = diffSchema(declared, columnsOf(declared));
    expect(drift).toEqual({ missingTables: [], missingColumns: [] });
    expect(hasDrift(drift)).toBe(false);
  });

  it("reports a missing column as table.column", () => {
    const db = columnsOf(declared).filter(
      (c) => !(c.table === "account" && c.column === "scope"),
    );
    const drift = diffSchema(declared, db);
    expect(drift).toEqual({
      missingTables: [],
      missingColumns: ["account.scope"],
    });
    expect(hasDrift(drift)).toBe(true);
  });

  it("reports a missing table once, not each of its columns", () => {
    const db = columnsOf(declared).filter((c) => c.table !== "chatbots");
    expect(diffSchema(declared, db)).toEqual({
      missingTables: ["chatbots"],
      missingColumns: [],
    });
  });

  it("reports every missing table and column together", () => {
    const db: DbColumn[] = [{ table: "account", column: "id" }];
    expect(diffSchema(declared, db)).toEqual({
      missingTables: ["chatbots"],
      missingColumns: ["account.user_id", "account.scope"],
    });
  });

  it("ignores columns and tables the database has but the code does not declare", () => {
    const db: DbColumn[] = [
      ...columnsOf(declared),
      { table: "account", column: "legacy_x" },
      { table: "old_table", column: "id" },
    ];
    expect(hasDrift(diffSchema(declared, db))).toBe(false);
  });
});

describe("formatDriftReport", () => {
  it("returns null when nothing is missing", () => {
    expect(
      formatDriftReport({ missingTables: [], missingColumns: [] }),
    ).toBeNull();
  });

  it("lists every missing table and table.column", () => {
    const report = formatDriftReport({
      missingTables: ["chatbots"],
      missingColumns: ["account.user_id", "account.scope"],
    });
    expect(report).toContain("Missing tables (1):\n  - chatbots");
    expect(report).toContain(
      "Missing columns (2):\n  - account.user_id\n  - account.scope",
    );
  });

  it("omits the tables section when only columns are missing", () => {
    const report = formatDriftReport({
      missingTables: [],
      missingColumns: ["account.scope"],
    });
    expect(report).not.toContain("Missing tables");
    expect(report).toContain("  - account.scope");
  });
});

describe("collectDeclaredTables", () => {
  it("collects every table in schema.ts with its SQL column names", () => {
    const tables = collectDeclaredTables(schema);
    const names = tables.map((t) => t.table);

    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names).toEqual(
      expect.arrayContaining(["user", "account", "chatbots", "file_chunks"]),
    );
    expect(tables.find((t) => t.table === "account")?.columns).toEqual(
      expect.arrayContaining(["scope", "user_id"]),
    );
  });

  it("skips enums, relations and other non-table exports", () => {
    const tables = collectDeclaredTables({
      notes: pgTable("notes", { id: uuid("id"), body: text("body_text") }),
      userStatusEnum: schema.userStatusEnum,
      userRelations: schema.userRelations,
      constant: 42,
    });
    expect(tables).toEqual([{ table: "notes", columns: ["id", "body_text"] }]);
  });

  it("refuses a table outside public rather than silently skipping it", () => {
    const other = pgSchema("analytics_private");
    expect(() =>
      collectDeclaredTables({ t: other.table("events", { id: uuid("id") }) }),
    ).toThrow("analytics_private.events");
  });
});

describe("DB_COLUMNS_QUERY", () => {
  it("reads base tables in public only", () => {
    expect(DB_COLUMNS_QUERY).toContain("c.table_schema = 'public'");
    expect(DB_COLUMNS_QUERY).toContain("t.table_type = 'BASE TABLE'");
  });
});
