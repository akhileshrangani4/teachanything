// Token budget allocator -- pure synchronous functions that compute how many
// chunks and history messages fit within a model's context window.
//
// Two-pass design:
//   Pass 1: calculateChunkLimit() estimates chunk count for the DB query LIMIT
//   Pass 2: allocateTokenBudget() fits actual returned chunks + history

/** 80% of context window reserved for input (D-02). */
export const BUDGET_RATIO = 0.8;

/** 60% of remaining budget for RAG chunks, 40% for history (D-05). */
export const CHUNK_SHARE = 0.6;

/** Approximate characters per token for fallback estimation. */
export const CHARS_PER_TOKEN = 4;

/** Conservative average chunk token estimate: 2500 chars / CHARS_PER_TOKEN (D-05). */
export const AVG_CHUNK_TOKENS = 625;

/** Input for the full budget allocation (Pass 2). */
export interface TokenBudgetInput {
  contextWindow: number;
  maxOutputTokens: number;
  systemPromptTokens: number;
  fileManifestTokens: number;
  userMessageTokens: number;
  /** Pre-counted token sizes for each available chunk. */
  availableChunks: Array<{ tokens: number }>;
  /** Pre-counted token sizes for history messages, chronological (oldest first). */
  availableHistory: Array<{ tokens: number }>;
}

/** Result of budget allocation with limits and diagnostics. */
export interface TokenBudgetResult {
  /** Number of chunks to keep (from start of availableChunks array). */
  chunkLimit: number;
  /** Number of history messages to keep (from END of availableHistory array). */
  historyLimit: number;
  /** Total input tokens after allocation (fixed + chunks kept + history kept). */
  totalInputTokens: number;
  /** Total input budget available (before allocation). */
  budgetCapacity: number;
  /** Whether any chunks or history were truncated. */
  truncated: boolean;
  /** Human-readable truncation descriptions for logging. */
  warnings: string[];
}

/**
 * Pass 1: Estimate chunk count for the DB query LIMIT.
 *
 * Uses AVG_CHUNK_TOKENS as a conservative estimate since actual chunk
 * token counts are unknown before the query.
 */
export function calculateChunkLimit(input: {
  contextWindow: number;
  maxOutputTokens: number;
  systemPromptTokens: number;
  fileManifestTokens: number;
  userMessageTokens: number;
}): number {
  const inputBudget =
    Math.floor(input.contextWindow * BUDGET_RATIO) - input.maxOutputTokens;
  const fixedTokens =
    input.systemPromptTokens +
    input.fileManifestTokens +
    input.userMessageTokens;
  const remaining = Math.max(0, inputBudget - fixedTokens);
  const chunkBudget = Math.floor(remaining * CHUNK_SHARE);

  return Math.max(0, Math.floor(chunkBudget / AVG_CHUNK_TOKENS));
}

/**
 * Pass 2: Allocate the full token budget across chunks and history.
 *
 * Priority fill order (D-01):
 *   1. System prompt (always full)
 *   2. File manifest (always full)
 *   3. User message (always full)
 *   4. RAG chunks (fill remaining * CHUNK_SHARE)
 *   5. Conversation history (fill what's left, newest first)
 */
export function allocateTokenBudget(
  input: TokenBudgetInput,
): TokenBudgetResult {
  const warnings: string[] = [];
  const inputBudget =
    Math.floor(input.contextWindow * BUDGET_RATIO) - input.maxOutputTokens;

  const fixedTokens =
    input.systemPromptTokens +
    input.fileManifestTokens +
    input.userMessageTokens;

  const remaining = Math.max(0, inputBudget - fixedTokens);

  if (remaining === 0) {
    warnings.push(
      `Fixed components (${fixedTokens} tokens) exceed input budget (${inputBudget} tokens). No room for chunks or history.`,
    );
    return {
      chunkLimit: 0,
      historyLimit: 0,
      totalInputTokens: fixedTokens,
      budgetCapacity: inputBudget,
      truncated: true,
      warnings,
    };
  }

  // Chunk allocation: iterate availableChunks until budget exhausted
  const chunkBudget = Math.floor(remaining * CHUNK_SHARE);
  let actualChunkTokens = 0;
  let chunkLimit = 0;

  for (const chunk of input.availableChunks) {
    if (actualChunkTokens + chunk.tokens > chunkBudget) break;
    actualChunkTokens += chunk.tokens;
    chunkLimit++;
  }

  // History allocation: fill newest-first (iterate from end of chronological array)
  const historyBudget = Math.max(0, remaining - actualChunkTokens);
  let historyTokens = 0;
  let historyLimit = 0;

  for (let i = input.availableHistory.length - 1; i >= 0; i--) {
    const msgTokens = input.availableHistory[i]!.tokens;
    if (historyTokens + msgTokens > historyBudget) break;
    historyTokens += msgTokens;
    historyLimit++;
  }

  // Truncation warnings (D-10)
  const chunksDropped = input.availableChunks.length - chunkLimit;
  if (chunksDropped > 0) {
    warnings.push(
      `Truncated ${chunksDropped} chunks (${input.availableChunks.length} available, ${chunkLimit} fit budget)`,
    );
  }

  const historyDropped = input.availableHistory.length - historyLimit;
  if (historyDropped > 0) {
    warnings.push(
      `Truncated ${historyDropped} history messages (${input.availableHistory.length} available, ${historyLimit} fit budget)`,
    );
  }

  const isTruncated = chunksDropped > 0 || historyDropped > 0;

  return {
    chunkLimit,
    historyLimit,
    totalInputTokens: fixedTokens + actualChunkTokens + historyTokens,
    budgetCapacity: inputBudget,
    truncated: isTruncated,
    warnings,
  };
}
