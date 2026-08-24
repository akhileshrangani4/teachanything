import { describe, it, expect } from "@jest/globals";
import {
  MODEL_REGISTRY,
  toolCapableModels,
  modelSupportsTools,
  resolveModel,
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
  it("dropped models (Gemma, Mistral, Nemotron) are no longer registered", () => {
    expect(
      (MODEL_REGISTRY as Record<string, unknown>)["google/gemma-4-31b-it"],
    ).toBeUndefined();
    expect(
      (MODEL_REGISTRY as Record<string, unknown>)[
        "mistralai/mistral-large-2411"
      ],
    ).toBeUndefined();
    expect(
      (MODEL_REGISTRY as Record<string, unknown>)[
        "nvidia/nemotron-3-super-120b-a12b"
      ],
    ).toBeUndefined();
  });
  it("toolCapableModels includes the current Qwen revision", () => {
    const ids = toolCapableModels().map((m) => m.id);
    expect(ids).toContain("qwen/qwen3-235b-a22b-2507");
    expect(ids).not.toContain("qwen/qwen3-235b-a22b");
  });
  it("toolCapableModels includes Mistral Large 3", () => {
    const ids = toolCapableModels().map((m) => m.id);
    expect(ids).toContain("mistralai/mistral-large-2512");
  });
  it("modelSupportsTools resolves deprecated/dropped ids to tool-capable models", () => {
    // old Qwen 3 -> 2507; retired Mistral -> Mistral Large 3; retired
    // Gemma/Nemotron -> replacement tool models
    expect(modelSupportsTools("qwen/qwen3-235b-a22b")).toBe(true);
    expect(modelSupportsTools("mistralai/mistral-large")).toBe(true);
    expect(modelSupportsTools("google/gemma-4-31b-it")).toBe(true);
    expect(modelSupportsTools("nvidia/nemotron-3-super-120b-a12b")).toBe(true);
  });
  it("retired Mistral ids resolve to Mistral Large 3, not the Llama stopgap", () => {
    expect(resolveModel("mistralai/mistral-large")).toBe(
      "mistralai/mistral-large-2512",
    );
    expect(resolveModel("mistralai/mistral-large-2411")).toBe(
      "mistralai/mistral-large-2512",
    );
  });
});
