import {
  toolCapableModels,
  type SupportedModel,
} from "@teachanything/ai/models";

// Agentic retrieval requires tool calling, so only tool-capable models are
// offered when creating a chatbot.
export const MODELS = toolCapableModels().map((m) => ({
  value: m.id as SupportedModel,
  label: m.displayName,
}));

export const DEFAULT_FORM_FIELDS = {
  name: "",
  description: "",
  model: "meta-llama/llama-3.3-70b-instruct" as SupportedModel,
  temperature: 70,
  maxTokens: 2000,
};

export const formatDate = (date: Date | string, locale: string) => {
  return new Date(date).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};
