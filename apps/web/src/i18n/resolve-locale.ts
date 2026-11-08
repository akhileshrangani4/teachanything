import {
  DEFAULT_LOCALE,
  ENABLED_LOCALES,
  isEnabledLocale,
  type Locale,
} from "./config";

/** Well-formed Accept-Language entries; a malformed q drops the entry. */
function parseEntries(header: string | null | undefined) {
  if (!header) return [];
  return header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const qParam = params.find((p) => /^q=/i.test(p.trim()));
      const qValue = qParam?.trim().slice(2).trim();
      const q = qValue === undefined ? 1 : qValue ? Number(qValue) : NaN;
      return { tag: tag.trim().toLowerCase(), q, index };
    })
    .filter((e) => e.tag && Number.isFinite(e.q) && e.q >= 0 && e.q <= 1);
}

/**
 * Accept-Language entries ordered by quality, highest first; ties keep header
 * order. Entries with q=0 or a malformed q are dropped.
 */
export function parseAcceptLanguage(
  header: string | null | undefined,
): string[] {
  return parseEntries(header)
    .filter((e) => e.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map((e) => e.tag);
}

/**
 * First enabled locale matching a language tag by its primary subtag. A
 * wildcard takes the first enabled locale the header did not exclude with q=0.
 */
function matchTag(
  tag: string,
  enabled: readonly Locale[],
  excluded: ReadonlySet<string>,
): Locale | undefined {
  if (tag === "*") return enabled.find((l) => !excluded.has(l));
  const primary = tag.split("-")[0];
  return enabled.find((l) => l === primary);
}

/**
 * Pick the UI language. A signed-in user's saved choice wins, then the
 * language cookie, then the browser's Accept-Language, then English.
 */
export function resolveLocale(input: {
  saved?: string | null;
  cookie?: string | null;
  acceptLanguage?: string | null;
  enabled?: readonly Locale[];
}): Locale {
  const enabled = input.enabled ?? ENABLED_LOCALES;
  if (isEnabledLocale(input.saved, enabled)) return input.saved;
  if (isEnabledLocale(input.cookie, enabled)) return input.cookie;
  const excluded = new Set(
    parseEntries(input.acceptLanguage)
      .filter((e) => e.q === 0)
      .map((e) => e.tag.split("-")[0] ?? e.tag),
  );
  for (const tag of parseAcceptLanguage(input.acceptLanguage)) {
    const match = matchTag(tag, enabled, excluded);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}
