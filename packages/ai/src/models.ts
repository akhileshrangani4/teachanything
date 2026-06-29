// Centralized model registry -- single source of truth for all model metadata.
// All consumers import from here; no independent model definitions elsewhere.

export type Provider = "Meta" | "Qwen" | "OpenAI" | "DeepSeek";

export interface ModelMetadata {
  id: string;
  displayName: string;
  provider: Provider;
  contextWindow: number;
  supportsTools: boolean;
}

/**
 * Authoritative model registry. Every supported model lives here with full
 * metadata. SUPPORTED_MODELS and SupportedModel are derived from this object
 * so there is exactly one place to add, remove, or update models.
 */
export const MODEL_REGISTRY = {
  "openai/gpt-oss-120b": {
    id: "openai/gpt-oss-120b",
    displayName: "GPT-OSS 120B",
    provider: "OpenAI",
    contextWindow: 131_072,
    supportsTools: true,
  },
  "qwen/qwen3-235b-a22b-2507": {
    id: "qwen/qwen3-235b-a22b-2507",
    displayName: "Qwen 3 235B (2507)",
    provider: "Qwen",
    contextWindow: 262_144,
    supportsTools: true,
  },
  "meta-llama/llama-3.3-70b-instruct": {
    id: "meta-llama/llama-3.3-70b-instruct",
    displayName: "Llama 3.3 70B",
    provider: "Meta",
    contextWindow: 131_072,
    supportsTools: true,
  },
  "meta-llama/llama-4-maverick": {
    id: "meta-llama/llama-4-maverick",
    displayName: "Llama 4 Maverick",
    provider: "Meta",
    contextWindow: 1_048_576,
    supportsTools: true,
  },
  "deepseek/deepseek-v3.2": {
    id: "deepseek/deepseek-v3.2",
    displayName: "DeepSeek V3.2",
    provider: "DeepSeek",
    contextWindow: 131_072,
    supportsTools: true,
  },
} as const satisfies Record<string, ModelMetadata>;

/**
 * Embedding model configuration.
 * Centralized here so changing the embedding model is a single edit.
 */
export const EMBEDDING_MODEL = {
  id: "text-embedding-3-small",
  dimensions: 1536,
  maxInputTokens: 8191,
} as const;

/** Union of all valid model IDs, derived from MODEL_REGISTRY keys. */
export type SupportedModel = keyof typeof MODEL_REGISTRY;

/**
 * Non-empty tuple of model IDs for use with z.enum().
 * Derived from MODEL_REGISTRY so there is no independent list to maintain.
 */
export const SUPPORTED_MODELS = Object.keys(MODEL_REGISTRY) as [
  SupportedModel,
  ...SupportedModel[],
];

/**
 * Maps retired/renamed model IDs to their current replacements.
 * Used by resolveModel() to transparently migrate stored model references.
 */
export const DEPRECATED_MODEL_MAP: Record<string, SupportedModel> = {
  // Qwen 3 235B -> the cheaper, larger-context 2507 revision.
  "qwen/qwen3-235b-a22b": "qwen/qwen3-235b-a22b-2507",
  "qwen/qwen-2.5-72b-instruct": "qwen/qwen3-235b-a22b-2507",
  // Mistral dropped (mistral-large-2411 retired from OpenRouter) and Gemma
  // dropped (unreliable tool-calling) -> migrate to the default tool model.
  "mistralai/mistral-large": "meta-llama/llama-3.3-70b-instruct",
  "mistralai/mistral-large-2411": "meta-llama/llama-3.3-70b-instruct",
  "google/gemma-4-31b-it": "meta-llama/llama-3.3-70b-instruct",
  // Nemotron 3 Super dropped: OpenRouter serves it in v2 compatibility mode
  // where the step-0 forced tool choice silently never fires, so the agentic
  // retrieval loop produces no tool call and no text (~50s of dead reasoning)
  // before falling back. Migrate to the strongest tool model (Qwen 3 235B).
  "nvidia/nemotron-3-super-120b-a12b": "qwen/qwen3-235b-a22b-2507",
};

/** List of deprecated model IDs for quick membership checks. */
export const DEPRECATED_MODELS = Object.keys(DEPRECATED_MODEL_MAP);

const DEFAULT_MODEL: SupportedModel = "meta-llama/llama-3.3-70b-instruct";

/**
 * Resolve a model ID string to a valid SupportedModel.
 *
 * 1. If the ID is already in MODEL_REGISTRY, return it as-is.
 * 2. If the ID is deprecated, return its replacement.
 * 3. Otherwise fall back to the default model.
 *
 * This function is idempotent: resolveModel(resolveModel(x)) === resolveModel(x).
 */
export function resolveModel(modelId: string): SupportedModel {
  if (modelId in MODEL_REGISTRY) {
    return modelId as SupportedModel;
  }
  if (modelId in DEPRECATED_MODEL_MAP) {
    return DEPRECATED_MODEL_MAP[modelId]!;
  }
  return DEFAULT_MODEL;
}

/**
 * Format a token count for display in the UI.
 * Examples: 131072 -> "128K context", 1048576 -> "1M context"
 */
export function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${Math.round(tokens / 1_000_000)}M context`;
  }
  return `${Math.round(tokens / 1024)}K context`;
}

/** Models whose tool-calling is reliable enough for agentic retrieval. */
export function toolCapableModels(): ModelMetadata[] {
  return (Object.values(MODEL_REGISTRY) as ModelMetadata[]).filter(
    (m) => m.supportsTools,
  );
}

/** Whether a (possibly deprecated) model id supports tools, after resolution. */
export function modelSupportsTools(modelId: string): boolean {
  return MODEL_REGISTRY[resolveModel(modelId)].supportsTools;
}
