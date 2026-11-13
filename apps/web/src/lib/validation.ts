import type { TFunction } from "i18next";

/**
 * Validation constants and utilities for chatbot forms
 */

export const VALIDATION_LIMITS = {
  NAME_MAX_LENGTH: 100,
  NAME_WARNING_THRESHOLD: 0.9, // 90% of max
  DESCRIPTION_MAX_LENGTH: 200,
  DESCRIPTION_WARNING_THRESHOLD: 0.9, // 90% of max
  WELCOME_MESSAGE_MAX_LENGTH: 500, // matches createChatbotSchema.welcomeMessage
  WELCOME_MESSAGE_WARNING_THRESHOLD: 0.9, // 90% of max
  MESSAGE_MAX_LENGTH: 16_000,
  MESSAGE_WARNING_THRESHOLD: 0.8, // 80% of max (orange)
  MESSAGE_CRITICAL_THRESHOLD: 0.95, // 95% of max (red)
} as const;

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  description?: string;
}

export function validateName(name: string, t: TFunction): ValidationResult {
  if (!name.trim()) {
    return {
      isValid: false,
      error: t("chatbots.validation.nameRequired"),
      description: t("chatbots.validation.nameRequiredHint"),
    };
  }

  if (name.length > VALIDATION_LIMITS.NAME_MAX_LENGTH) {
    return {
      isValid: false,
      error: t("chatbots.validation.nameTooLong"),
      description: t("chatbots.validation.nameTooLongHint", {
        max: VALIDATION_LIMITS.NAME_MAX_LENGTH,
      }),
    };
  }

  return { isValid: true };
}

export function validateDescription(
  description: string | null | undefined,
  t: TFunction,
  required = false,
): ValidationResult {
  const desc = description ?? "";

  if (required && !desc.trim()) {
    return {
      isValid: false,
      error: t("chatbots.validation.descriptionRequired"),
      description: t("chatbots.validation.descriptionRequiredHint"),
    };
  }

  if (desc && desc.length > VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH) {
    return {
      isValid: false,
      error: t("chatbots.validation.descriptionTooLong"),
      description: t("chatbots.validation.descriptionTooLongHint", {
        max: VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH,
      }),
    };
  }

  return { isValid: true };
}
