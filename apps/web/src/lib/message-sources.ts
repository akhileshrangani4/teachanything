/**
 * Shared helpers for rendering RAG source citations across chat surfaces
 * (live chat and conversation audit views).
 */

export type SourceCitation = {
  fileName: string;
  chunkIndex: number;
  similarity: number;
  pageNumber?: number | null;
};

/** A file's citations collapsed into one badge. */
export type GroupedSource = {
  fileName: string;
  /** Pages cited, ascending. Empty for sources with no page concept (web). */
  pageNumbers: number[];
  /** Best similarity among the citations that were grouped. */
  similarity: number;
  /** Chunk index of that best citation. */
  chunkIndex: number;
};

/**
 * Collapse citations to one entry per file, carrying the pages cited.
 *
 * This replaced a dedupe that keyed on file AND page, so a reply drawing on
 * six pages of one PDF produced six badges and a source footer taller than the
 * answer it belonged to (#397). One badge per file with its page count keeps
 * the citation honest without letting it dominate the message.
 *
 * Sorted by similarity, best first, so a capped list shows the sources that
 * actually mattered rather than whichever the database returned first.
 */
export function groupSourcesByFile(sources: SourceCitation[]): GroupedSource[] {
  const groups = new Map<string, GroupedSource>();

  for (const source of sources) {
    const existing = groups.get(source.fileName);
    const page = source.pageNumber;

    if (!existing) {
      groups.set(source.fileName, {
        fileName: source.fileName,
        pageNumbers: page == null ? [] : [page],
        similarity: source.similarity,
        chunkIndex: source.chunkIndex,
      });
      continue;
    }

    if (page != null && !existing.pageNumbers.includes(page)) {
      existing.pageNumbers.push(page);
    }
    // The badge's tooltip and ordering follow the strongest match in the group.
    if (source.similarity > existing.similarity) {
      existing.similarity = source.similarity;
      existing.chunkIndex = source.chunkIndex;
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      pageNumbers: [...group.pageNumbers].sort((a, b) => a - b),
    }))
    .sort((a, b) => b.similarity - a.similarity);
}

const WEB_PREFIX = "Web: ";

/**
 * Display name for a retrieved chunk's source. Crawler-sourced files carry a
 * URL in storagePath -- collapse them to `Web: <hostname>` so many pages from
 * one site dedupe into a single badge. Uploads keep their file name. Used by
 * both the static RAG path and the agentic retrieval tools so their source
 * names match and merge/dedupe correctly.
 */
export function sourceDisplayName(
  fileName: string,
  storagePath: string | null | undefined,
): string {
  const rawName = fileName || "Unknown";
  if (storagePath && /^https?:\/\//i.test(storagePath)) {
    try {
      return `${WEB_PREFIX}${new URL(storagePath).hostname}`;
    } catch {
      // malformed URL, fall back to raw filename
    }
  }
  return rawName;
}

/**
 * rag-context.ts tags crawler-sourced chunks as `Web: <hostname>` so many
 * pages from the same site collapse to one badge. Splitting returns the
 * human label (without the prefix) and whether it came from the web.
 */
export function describeSource(source: { fileName: string }): {
  isWeb: boolean;
  label: string;
} {
  if (source.fileName.startsWith(WEB_PREFIX)) {
    return { isWeb: true, label: source.fileName.slice(WEB_PREFIX.length) };
  }
  return { isWeb: false, label: source.fileName };
}
