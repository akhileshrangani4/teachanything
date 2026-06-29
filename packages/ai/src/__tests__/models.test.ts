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
  it("every registered model is tool-capable (picker requires tools)", () => {
    expect(toolCapableModels().length).toBe(Object.keys(MODEL_REGISTRY).length);
  });
  it("dropped models (Gemma, Mistral) are no longer registered", () => {
    expect(
      (MODEL_REGISTRY as Record<string, unknown>)["google/gemma-4-31b-it"],
    ).toBeUndefined();
    expect(
      (MODEL_REGISTRY as Record<string, unknown>)[
        "mistralai/mistral-large-2411"
      ],
    ).toBeUndefined();
  });
  it("toolCapableModels includes the current Qwen revision", () => {
    const ids = toolCapableModels().map((m) => m.id);
    expect(ids).toContain("qwen/qwen3-235b-a22b-2507");
    expect(ids).not.toContain("qwen/qwen3-235b-a22b");
  });
  it("modelSupportsTools resolves deprecated/dropped ids to tool-capable models", () => {
    // old Qwen 3 -> 2507; retired Mistral/Gemma -> default tool model
    expect(modelSupportsTools("qwen/qwen3-235b-a22b")).toBe(true);
    expect(modelSupportsTools("mistralai/mistral-large")).toBe(true);
    expect(modelSupportsTools("google/gemma-4-31b-it")).toBe(true);
  });
});
