import { describe, it, expect } from "@jest/globals";
import { PgDialect } from "drizzle-orm/pg-core";
import { hasQuotedPhrase, lexicalTsQuery } from "@/server/hybrid-search";

describe("hasQuotedPhrase", () => {
  it("detects a quoted phrase (triggers FTS boost)", () => {
    expect(hasQuotedPhrase('did it mention "the Berlin airlift"?')).toBe(true);
  });
  it("is false for unquoted queries", () => {
    expect(hasQuotedPhrase("does it mention the berlin airlift")).toBe(false);
  });
  it("ignores empty quotes", () => {
    expect(hasQuotedPhrase('an empty "" pair')).toBe(false);
  });
});

describe("lexicalTsQuery", () => {
  const render = (query: string) =>
    new PgDialect().sqlToQuery(lexicalTsQuery(query));

  it("ORs the words of an unquoted question", () => {
    const { sql, params } = render("what does the author argue about memory");
    expect(sql).toContain("plainto_tsquery('english', $1)");
    expect(sql).toContain("replace(");
    expect(sql).toContain("'&', '|'");
    expect(params).toEqual(["what does the author argue about memory"]);
  });

  it("keeps websearch phrase semantics when a phrase is quoted", () => {
    const { sql, params } = render('did it mention "the Berlin airlift"?');
    expect(sql).toContain("websearch_to_tsquery('english', $1)");
    expect(sql).not.toContain("replace(");
    expect(params).toEqual(['did it mention "the Berlin airlift"?']);
  });

  it("passes the query as a bound parameter, never inline", () => {
    const { sql } = render("x'); drop table file_chunks; --");
    expect(sql).not.toContain("drop table");
  });
});
