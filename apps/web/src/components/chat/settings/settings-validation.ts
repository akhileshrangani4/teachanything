import {
  validateName,
  validateDescription,
  VALIDATION_LIMITS,
} from "@/lib/validation";
import type { SettingsDraft } from "./settings-draft";

export interface SettingsValidationIssue {
  title: string;
  description?: string;
}

/**
 * Validates the editable settings draft before saving. Returns the first
 * problem found (in field order) or null when the draft is valid.
 */
export function validateSettingsDraft(
  draft: SettingsDraft,
): SettingsValidationIssue | null {
  const {
    name,
    description,
    welcomeMessage,
    temperature,
    maxTokens,
    systemPrompt,
  } = draft;

  const nameValidation = validateName(name);
  if (!nameValidation.isValid) {
    return {
      title: nameValidation.error!,
      description: nameValidation.description,
    };
  }

  const descriptionValidation = validateDescription(description);
  if (!descriptionValidation.isValid) {
    return {
      title: descriptionValidation.error!,
      description: descriptionValidation.description,
    };
  }

  if (welcomeMessage.length > VALIDATION_LIMITS.WELCOME_MESSAGE_MAX_LENGTH) {
    return {
      title: "Welcome message is too long",
      description: `Welcome message must be ${VALIDATION_LIMITS.WELCOME_MESSAGE_MAX_LENGTH} characters or less`,
    };
  }

  const tempValue = parseFloat(temperature);
  if (isNaN(tempValue) || tempValue < 0 || tempValue > 100) {
    return {
      title: "Invalid temperature",
      description: "Temperature must be between 0 and 100",
    };
  }

  const tokensValue = parseInt(maxTokens);
  if (isNaN(tokensValue) || tokensValue < 100 || tokensValue > 4000) {
    return {
      title: "Invalid max tokens",
      description: "Max tokens must be between 100 and 4000",
    };
  }

  if (!systemPrompt.trim()) {
    return {
      title: "System prompt is required",
      description: "Please provide a system prompt for your chatbot",
    };
  }

  return null;
}
