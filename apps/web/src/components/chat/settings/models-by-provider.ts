import { toolCapableModels } from "@teachanything/ai/models";

// Group tool-capable models by provider for the dropdown. Agentic retrieval
// requires tool calling, so non-tool models are not offered. Map preserves
// MODEL_REGISTRY insertion order.
export const modelsByProvider = toolCapableModels().reduce((acc, model) => {
  const group = acc.get(model.provider) ?? [];
  group.push(model);
  acc.set(model.provider, group);
  return acc;
}, new Map<string, ReturnType<typeof toolCapableModels>>());
