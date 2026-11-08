import { describe, it, expect } from "@jest/globals";
import en from "../../../messages/en.json";
import { createI18n } from "@/i18n/create-i18n";
import {
  failedPasswordErrors,
  firstPasswordError,
  passwordRuleError,
  passwordRuleLabel,
  passwordStrengthLabel,
} from "@/lib/password/password-messages";
import { PASSWORD_RULES } from "@/lib/password/password-rules";

const english = createI18n("en", en);

describe("password rule messages", () => {
  it("match the English in PASSWORD_RULES for every rule", () => {
    for (const rule of PASSWORD_RULES) {
      expect(passwordRuleLabel(english.t, rule.id)).toBe(rule.label);
      expect(passwordRuleError(english.t, rule.id)).toBe(rule.errorMessage);
    }
  });

  it("throw on an unknown rule id", () => {
    expect(() => passwordRuleLabel(english.t, "nope")).toThrow(
      "Unknown password rule: nope",
    );
    expect(() => passwordRuleError(english.t, "nope")).toThrow(
      "Unknown password rule: nope",
    );
  });
});

describe("failedPasswordErrors", () => {
  it("lists only the unmet rules, in order", () => {
    expect(
      failedPasswordErrors(english.t, [
        { id: "hasNumber", met: false },
        { id: "minLength", met: true },
        { id: "hasUppercase", met: false },
      ]),
    ).toEqual([
      "Password must contain at least one number",
      "Password must contain at least one uppercase letter",
    ]);
  });
});

describe("firstPasswordError", () => {
  it("returns the first unmet rule's error", () => {
    expect(
      firstPasswordError(english.t, [
        { id: "minLength", met: true },
        { id: "hasUppercase", met: false },
        { id: "hasNumber", met: false },
      ]),
    ).toBe("Password must contain at least one uppercase letter");
  });

  it("falls back to the general message when no rule failed", () => {
    expect(
      firstPasswordError(english.t, [{ id: "minLength", met: true }]),
    ).toBe(en.settings.password.notMeetRequirements);
  });
});

describe("passwordStrengthLabel", () => {
  it.each([
    ["weak", en.settings.password.strengthLevels.weak],
    ["medium", en.settings.password.strengthLevels.medium],
    ["strong", en.settings.password.strengthLevels.strong],
    ["very-strong", en.settings.password.strengthLevels.veryStrong],
  ] as const)("labels %s", (strength, label) => {
    expect(passwordStrengthLabel(english.t, strength)).toBe(label);
  });
});
