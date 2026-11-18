import { describe, it, expect } from "@jest/globals";
import en from "../../../messages/en.json";
import { createI18n } from "@/i18n/create-i18n";
import { contextWindowLabel } from "@/components/chat/settings/context-window-label";

const { t } = createI18n("en", en);

describe("contextWindowLabel", () => {
  it("labels windows under a million tokens in K, by 1024", () => {
    expect(contextWindowLabel(t, 131_072)).toBe("128K context");
    expect(contextWindowLabel(t, 999_999)).toBe("977K context");
  });

  it("labels a million tokens and up in M", () => {
    expect(contextWindowLabel(t, 1_000_000)).toBe("1M context");
    expect(contextWindowLabel(t, 2_000_000)).toBe("2M context");
  });
});
