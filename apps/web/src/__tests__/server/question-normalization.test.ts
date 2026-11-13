/**
 * @jest-environment node
 *
 * Fixture table for the Common Questions grouping key. Every row is checked
 * against the TypeScript normalizer, and, when TEST_DATABASE_URL points at a
 * Postgres database, against the SQL normalizer too, so the twins are proven
 * to agree on the same inputs.
 */
import { describe, it, expect, afterAll } from "@jest/globals";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  normalizeQuestion,
  normalizedQuestionSql,
} from "@/server/routers/analytics/question-normalization";

const NORMALIZATION_FIXTURES: ReadonlyArray<
  readonly [input: string, expected: string]
> = [
  // The issue's example: all three are one question.
  ["What is photosynthesis?", "photosynthesis"],
  ["photosynthesis", "photosynthesis"],
  ["whats  photosynthesis", "photosynthesis"],
  ["What's photosynthesis", "photosynthesis"],
  ["What\u2019s photosynthesis?", "photosynthesis"],
  // Each filler, and case and surrounding whitespace.
  ["  EXPLAIN photosynthesis!!  ", "photosynthesis"],
  ["Define: photosynthesis", "photosynthesis"],
  ["tell me about photosynthesis...", "photosynthesis"],
  // Distinct topics stay distinct.
  ["what is mitosis", "mitosis"],
  ["what is meiosis", "meiosis"],
  // Punctuation separates words; whitespace of any kind collapses.
  ["cell-division", "cell division"],
  ["cell\tdivision\n", "cell division"],
  ["cell\u00a0division", "cell division"],
  [
    "\u00bfQu\u00e9 es la fotos\u00edntesis?",
    "qu\u00e9 es la fotos\u00edntesis",
  ],
  // A filler is stripped only once, only at the start, only before a topic.
  ["what is what is love", "what is love"],
  ["so what is photosynthesis", "so what is photosynthesis"],
  ["define", "define"],
  ["What is?", "what is"],
  ["defined terms", "defined terms"],
  ["explaining photosynthesis", "explaining photosynthesis"],
  // Apostrophes are deleted rather than split into words.
  ["Newton's laws", "newtons laws"],
  // Nothing left but punctuation.
  ["???", ""],
  ["", ""],
];

describe("normalizeQuestion", () => {
  it.each(NORMALIZATION_FIXTURES)("normalizes %j to %j", (input, expected) => {
    expect(normalizeQuestion(input)).toBe(expected);
  });
});

// Opt-in and local only: run from apps/web (`TEST_DATABASE_URL=... npm test`),
// since Turbo's strict env mode does not pass undeclared vars through.
// eslint-disable-next-line turbo/no-undeclared-env-vars
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeWithDatabase = TEST_DATABASE_URL ? describe : describe.skip;

describeWithDatabase("normalizedQuestionSql (needs TEST_DATABASE_URL)", () => {
  const client = postgres(TEST_DATABASE_URL ?? "", {
    prepare: false,
    max: 1,
    onnotice: () => {},
  });
  const db = drizzle(client);

  afterAll(async () => {
    await client.end();
  });

  it("agrees with normalizeQuestion on every fixture", async () => {
    const inputs = NORMALIZATION_FIXTURES.map(([input]) => input);
    const inputArray = sql`array[${sql.join(
      inputs.map((text) => sql`${text}`),
      sql`, `,
    )}]::text[]`;
    const rows = await db.execute<{ input: string; normalized: string }>(
      sql`select input, ${normalizedQuestionSql(sql`input`)} as normalized
          from unnest(${inputArray}) with ordinality as fixtures(input, position)
          order by position`,
    );

    const sqlResults = rows.map((row) => [row.input, row.normalized]);
    const tsResults = inputs.map((text) => [text, normalizeQuestion(text)]);
    expect(sqlResults).toEqual(tsResults);
    expect(sqlResults).toEqual(NORMALIZATION_FIXTURES);
  });
});
