import { describe, it, expect } from "@jest/globals";
import { validateSettingsDraft } from "@/components/chat/settings/settings-validation";
import type { SettingsDraft } from "@/components/chat/settings/settings-draft";

const draft = (over: Partial<SettingsDraft> = {}): SettingsDraft => ({
  name: "Study Bot",
  description: "Helps with coursework",
  model: "openai/gpt-4o-mini",
  systemPrompt: "You are a helpful tutor.",
  temperature: "70",
  maxTokens: "2000",
  showSources: true,
  ...over,
});

describe("validateSettingsDraft", () => {
  it("accepts a valid draft", () => {
    expect(validateSettingsDraft(draft())).toBeNull();
  });

  it("accepts the temperature and token boundaries", () => {
    expect(
      validateSettingsDraft(draft({ temperature: "0", maxTokens: "100" })),
    ).toBeNull();
    expect(
      validateSettingsDraft(draft({ temperature: "100", maxTokens: "4000" })),
    ).toBeNull();
  });

  it("rejects a temperature outside 0-100", () => {
    expect(validateSettingsDraft(draft({ temperature: "101" }))?.title).toBe(
      "Invalid temperature",
    );
    expect(validateSettingsDraft(draft({ temperature: "-1" }))?.title).toBe(
      "Invalid temperature",
    );
  });

  it("rejects an unparseable temperature", () => {
    expect(validateSettingsDraft(draft({ temperature: "" }))?.title).toBe(
      "Invalid temperature",
    );
    expect(validateSettingsDraft(draft({ temperature: "abc" }))?.title).toBe(
      "Invalid temperature",
    );
  });

  it("rejects max tokens outside 100-4000", () => {
    expect(validateSettingsDraft(draft({ maxTokens: "99" }))?.title).toBe(
      "Invalid max tokens",
    );
    expect(validateSettingsDraft(draft({ maxTokens: "4001" }))?.title).toBe(
      "Invalid max tokens",
    );
  });

  it("rejects an unparseable max tokens", () => {
    expect(validateSettingsDraft(draft({ maxTokens: "" }))?.title).toBe(
      "Invalid max tokens",
    );
  });

  it("rejects a whitespace-only system prompt", () => {
    expect(validateSettingsDraft(draft({ systemPrompt: "   " }))?.title).toBe(
      "System prompt is required",
    );
  });

  // The inputs are `type="number"` in the UI, but the draft holds raw strings,
  // so parseFloat/parseInt's prefix parsing is the real contract. Pinned so a
  // future switch to Number() (which rejects these) is a deliberate change.
  it("accepts a numeric prefix the way parseFloat/parseInt do", () => {
    expect(validateSettingsDraft(draft({ temperature: "70abc" }))).toBeNull();
    expect(validateSettingsDraft(draft({ maxTokens: "2000abc" }))).toBeNull();
  });

  it("reports problems in field order, name first", () => {
    const issue = validateSettingsDraft(
      draft({ name: "", temperature: "999", systemPrompt: "" }),
    );
    expect(issue?.title).not.toBe("Invalid temperature");
    expect(issue?.title).not.toBe("System prompt is required");
  });

  it("checks temperature before max tokens", () => {
    expect(
      validateSettingsDraft(draft({ temperature: "999", maxTokens: "999999" }))
        ?.title,
    ).toBe("Invalid temperature");
  });
});
