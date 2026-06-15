/** A ranked candidate list from one retrieval method. items[0] is rank 1. */
export interface RankedList<T> {
  items: T[];
  /** Multiplier on this list's RRF contribution. Default 1. */
  weight?: number;
}

export interface RRFOptions {
  /** Smoothing constant. Cormack 2009 default = 60. */
  k?: number;
}

/**
 * Reciprocal Rank Fusion. Fuses multiple ranked lists into one ordering using
 * only ordinal rank (not raw scores), so heterogeneous scorers (cosine, BM25,
 * trigram) combine without scale normalization. score(d) = Σ weight_i / (k + rank_i).
 */
export function reciprocalRankFusion<T>(
  lists: Array<RankedList<T>>,
  options: RRFOptions = {},
): T[] {
  const k = options.k ?? 60;
  const scores = new Map<T, number>();

  for (const { items, weight = 1 } of lists) {
    items.forEach((item, index) => {
      const rank = index + 1; // rank is 1-based
      const contribution = weight / (k + rank);
      scores.set(item, (scores.get(item) ?? 0) + contribution);
    });
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([item]) => item);
}
