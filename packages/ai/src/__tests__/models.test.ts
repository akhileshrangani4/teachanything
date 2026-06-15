import { describe, it, expect } from "@jest/globals";
import {
  MODEL_REGISTRY,
  toolCapableModels,
  modelSupportsTools,
} from "../models";

describe("supportsTools gating", () => {
  it("every model declares supportsTools", () => {
    for (const m of Object.values(MODEL_REGISTRY)) {
      expect(typeof m.supportsTools).toBe("boolean");
    }
  });
  it("Gemma is marked non-tool (broken via OpenRouter)", () => {
    expect(MODEL_REGISTRY["google/gemma-4-31b-it"].supportsTools).toBe(false);
  });
  it("toolCapableModels excludes non-tool models", () => {
    const ids = toolCapableModels().map((m) => m.id);
    expect(ids).not.toContain("google/gemma-4-31b-it");
    expect(ids).toContain("qwen/qwen3-235b-a22b");
  });
  it("modelSupportsTools resolves deprecated ids", () => {
    expect(modelSupportsTools("mistralai/mistral-large")).toBe(true);
  });
});
