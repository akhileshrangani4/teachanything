import {
  MODEL_REGISTRY,
  type SupportedModel,
} from "@teachanything/ai/models";

export const MODELS = Object.values(MODEL_REGISTRY).map((m) => ({
  value: m.id as SupportedModel,
  label: m.displayName,
}));

export type ModelValue = SupportedModel;

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
