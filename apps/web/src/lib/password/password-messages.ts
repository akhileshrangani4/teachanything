import type { TFunction } from "i18next";

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

type Requirement = { id: string; met: boolean };

/** Checklist label for a password rule, by the rule's id in PASSWORD_RULES. */
export function passwordRuleLabel(t: TFunction, id: string): string {
  switch (id) {
    case "minLength":
      return t("settings.passwordRules.minLength.label", { min: MIN_LENGTH });
    case "maxLength":
      return t("settings.passwordRules.maxLength.label", { max: MAX_LENGTH });
    case "hasLowercase":
      return t("settings.passwordRules.hasLowercase.label");
    case "hasUppercase":
      return t("settings.passwordRules.hasUppercase.label");
    case "hasNumber":
      return t("settings.passwordRules.hasNumber.label");
    case "hasSpecialChar":
      return t("settings.passwordRules.hasSpecialChar.label");
    case "noRepeatedChars":
      return t("settings.passwordRules.noRepeatedChars.label");
    case "noSequentialChars":
      return t("settings.passwordRules.noSequentialChars.label");
    case "notCommon":
      return t("settings.passwordRules.notCommon.label");
    default:
      throw new Error(`Unknown password rule: ${id}`);
  }
}

/** Error shown when a password fails a rule. */
export function passwordRuleError(t: TFunction, id: string): string {
  switch (id) {
    case "minLength":
      return t("settings.passwordRules.minLength.error", { min: MIN_LENGTH });
    case "maxLength":
      return t("settings.passwordRules.maxLength.error", { max: MAX_LENGTH });
    case "hasLowercase":
      return t("settings.passwordRules.hasLowercase.error");
    case "hasUppercase":
      return t("settings.passwordRules.hasUppercase.error");
    case "hasNumber":
      return t("settings.passwordRules.hasNumber.error");
    case "hasSpecialChar":
      return t("settings.passwordRules.hasSpecialChar.error");
    case "noRepeatedChars":
      return t("settings.passwordRules.noRepeatedChars.error");
    case "noSequentialChars":
      return t("settings.passwordRules.noSequentialChars.error");
    case "notCommon":
      return t("settings.passwordRules.notCommon.error");
    default:
      throw new Error(`Unknown password rule: ${id}`);
  }
}

export function failedPasswordErrors(
  t: TFunction,
  requirements: Requirement[],
): string[] {
  return requirements
    .filter((r) => !r.met)
    .map((r) => passwordRuleError(t, r.id));
}

export function firstPasswordError(
  t: TFunction,
  requirements: Requirement[],
): string {
  return (
    failedPasswordErrors(t, requirements)[0] ??
    t("settings.password.notMeetRequirements")
  );
}

/** Label for a strength level from validatePasswordStrength. */
export function passwordStrengthLabel(
  t: TFunction,
  strength: "weak" | "medium" | "strong" | "very-strong",
): string {
  switch (strength) {
    case "weak":
      return t("settings.password.strengthLevels.weak");
    case "medium":
      return t("settings.password.strengthLevels.medium");
    case "strong":
      return t("settings.password.strengthLevels.strong");
    case "very-strong":
      return t("settings.password.strengthLevels.veryStrong");
  }
}
