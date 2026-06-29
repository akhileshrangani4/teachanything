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

export const DEFAULT_FORM_DATA = {
  name: "",
  description: "",
  model: "meta-llama/llama-3.3-70b-instruct" as SupportedModel,
  systemPrompt:
    "You are a helpful teaching assistant. Answer questions based on the provided context from course materials.",
  temperature: 70,
  maxTokens: 2000,
};

export const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};
