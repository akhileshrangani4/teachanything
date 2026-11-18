/**
 * Grouping key for the Common Questions card (#315, rung 1).
 *
 * Two implementations of one function: `normalizedQuestionSql` builds the key
 * in Postgres so grouping and pagination stay in the database, and
 * `normalizeQuestion` is its pure TypeScript twin, used to test and document
 * the rules. Both read the constants below, and a fixture-table test runs both
 * over the same inputs, so they cannot drift apart silently.
 *
 * Steps, in order:
 * 1. lowercase;
 * 2. delete apostrophes, so contractions collapse ("what's" -> "whats");
 * 3. turn every other listed punctuation or whitespace character into a space;
 * 4. collapse runs of spaces and trim;
 * 5. strip one leading filler phrase, when followed by more text.
 *
 * Characters are listed explicitly instead of using `[[:punct:]]` or `\s`
 * because those classes depend on the database locale in Postgres and on
 * Unicode tables in JS. An explicit list behaves the same in both. `lower()`
 * still follows the database collation, so the twins are only guaranteed to
 * agree on letters whose lowercase form the collation and JS share (all of
 * ASCII).
 */
import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

/** Deleted outright. */
const APOSTROPHES = "'`\u2018\u2019";

/** Replaced with a space, so "cell-division" matches "cell division". */
const SEPARATORS =
  '!"#$%&()*+,-./:;<=>?@[\\]^_{|}~' +
  "\u00a1\u00bf\u00ab\u00bb\u201c\u201d\u2026\u2013\u2014" +
  "\t\n\r\f\v\u00a0";

/**
 * Leading phrases that do not change what is being asked, already in
 * normalized form ("what's" normalizes to "whats" in step 2). Only letters and
 * spaces, so they are safe inside a regex alternation without escaping.
 */
export const LEADING_FILLERS = [
  "what is",
  "whats",
  "explain",
  "define",
  "tell me about",
] as const;

/**
 * The trailing space means a filler is stripped only when a topic follows it:
 * "define" alone stays "define", and "defined" is untouched. Postgres AREs and
 * JS regexes read this pattern identically.
 */
const LEADING_FILLER_PATTERN = `^(?:${LEADING_FILLERS.join("|")}) `;

// Postgres `translate()` maps from[i] to to[i] and deletes characters past the
// end of `to`, so separators come first and apostrophes last.
const TRANSLATE_FROM = SEPARATORS + APOSTROPHES;
const TRANSLATE_TO = " ".repeat(SEPARATORS.length);

const LEADING_FILLER_REGEX = new RegExp(LEADING_FILLER_PATTERN);

function translateCharacter(character: string): string {
  if (APOSTROPHES.includes(character)) return "";
  if (SEPARATORS.includes(character)) return " ";
  return character;
}

/** Pure TypeScript twin of `normalizedQuestionSql`. */
export function normalizeQuestion(text: string): string {
  const translated = Array.from(text.toLowerCase(), translateCharacter).join(
    "",
  );
  const collapsed = translated.replace(/ +/g, " ").replace(/^ | $/g, "");
  return collapsed.replace(LEADING_FILLER_REGEX, "");
}

/** SQL expression for the normalized grouping key of `column`. */
export function normalizedQuestionSql(column: SQLWrapper): SQL<string> {
  const translated = sql`translate(lower(${column}), ${TRANSLATE_FROM}, ${TRANSLATE_TO})`;
  const collapsed = sql`btrim(regexp_replace(${translated}, ' +', ' ', 'g'), ' ')`;
  // No 'g' flag: the anchored pattern strips at most one filler.
  return sql<string>`regexp_replace(${collapsed}, ${LEADING_FILLER_PATTERN}, '')`;
}
