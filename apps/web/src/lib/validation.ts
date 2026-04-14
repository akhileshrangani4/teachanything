/**
 * Validation constants and utilities for chatbot forms
 */

export const VALIDATION_LIMITS = {
  NAME_MAX_LENGTH: 100,
  NAME_WARNING_THRESHOLD: 90, // 90% of max
  DESCRIPTION_MAX_LENGTH: 200,
  DESCRIPTION_WARNING_THRESHOLD: 180, // 90% of max
  MESSAGE_MAX_LENGTH: 16_000,
  MESSAGE_WARNING_THRESHOLD: 0.8, // 80% of max (orange)
  MESSAGE_CRITICAL_THRESHOLD: 0.95, // 95% of max (red)
} as const;

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  description?: string;
}

export function validateName(name: string): ValidationResult {
  if (!name.trim()) {
    return {
      isValid: false,
      error: "Name is required",
      description: "Please provide a name for your chatbot",
    };
  }

  if (name.length > VALIDATION_LIMITS.NAME_MAX_LENGTH) {
    return {
      isValid: false,
      error: "Name is too long",
      description: `Name must be ${VALIDATION_LIMITS.NAME_MAX_LENGTH} characters or less`,
    };
  }

  return { isValid: true };
}

export function validateDescription(
  description: string | null | undefined,
  required = false,
): ValidationResult {
  const desc = description ?? "";

  if (required && !desc.trim()) {
    return {
      isValid: false,
      error: "Description is required",
      description: "Please provide a description for your chatbot",
    };
  }

  if (desc && desc.length > VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH) {
    return {
      isValid: false,
      error: "Description is too long",
      description: `Description must be ${VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH} characters or less`,
    };
  }

  return { isValid: true };
}
