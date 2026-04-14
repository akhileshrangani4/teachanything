// Centralized model registry -- single source of truth for all model metadata.
// All consumers import from here; no independent model definitions elsewhere.

export type PricingTier = "free" | "$" | "$$";

export type Provider =
  | "Meta"
  | "Mistral"
  | "Qwen"
  | "OpenAI"
  | "NVIDIA"
  | "Google";

export interface ModelMetadata {
  id: string;
  displayName: string;
  provider: Provider;
  contextWindow: number;
  pricingTier: PricingTier;
  capabilities: string[];
}

/**
 * Authoritative model registry. Every supported model lives here with full
 * metadata. SUPPORTED_MODELS and SupportedModel are derived from this object
 * so there is exactly one place to add, remove, or update models.
 */
export const MODEL_REGISTRY = {
  "meta-llama/llama-3.3-70b-instruct": {
    id: "meta-llama/llama-3.3-70b-instruct",
    displayName: "Llama 3.3 70B",
    provider: "Meta",
    contextWindow: 131_072,
    pricingTier: "$",
    capabilities: ["chat", "multilingual"],
  },
  "mistralai/mistral-large-2411": {
    id: "mistralai/mistral-large-2411",
    displayName: "Mistral Large 2411",
    provider: "Mistral",
    contextWindow: 131_072,
    pricingTier: "$$",
    capabilities: ["chat", "function-calling", "multilingual"],
  },
  "qwen/qwen3-235b-a22b": {
    id: "qwen/qwen3-235b-a22b",
    displayName: "Qwen 3 235B",
    provider: "Qwen",
    contextWindow: 131_072,
    pricingTier: "$",
    capabilities: ["chat", "multilingual"],
  },
  "openai/gpt-oss-120b": {
    id: "openai/gpt-oss-120b",
    displayName: "GPT-OSS 120B",
    provider: "OpenAI",
    contextWindow: 131_072,
    pricingTier: "$",
    capabilities: ["chat"],
  },
  "meta-llama/llama-4-maverick": {
    id: "meta-llama/llama-4-maverick",
    displayName: "Llama 4 Maverick",
    provider: "Meta",
    contextWindow: 1_048_576,
    pricingTier: "$",
    capabilities: ["chat", "multimodal"],
  },
  "nvidia/nemotron-3-super-120b-a12b": {
    id: "nvidia/nemotron-3-super-120b-a12b",
    displayName: "Nemotron 3 Super",
    provider: "NVIDIA",
    contextWindow: 262_144,
    pricingTier: "$",
    capabilities: ["chat"],
  },
  "google/gemma-4-31b-it": {
    id: "google/gemma-4-31b-it",
    displayName: "Gemma 4 31B",
    provider: "Google",
    contextWindow: 262_144,
    pricingTier: "$",
    capabilities: ["chat", "multimodal"],
  },
} as const satisfies Record<string, ModelMetadata>;

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
  "mistralai/mistral-large": "mistralai/mistral-large-2411",
  "qwen/qwen-2.5-72b-instruct": "qwen/qwen3-235b-a22b",
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
