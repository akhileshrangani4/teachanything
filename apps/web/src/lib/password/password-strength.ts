/**
 * Frontend password strength calculation and UI utilities
 * Only used on the client side for UX feedback
 */

import { validatePassword, getPasswordRequirements } from "./password-rules";

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: "weak" | "medium" | "strong" | "very-strong";
  score: number; // 0-100
  requirements: Array<{ id: string; label: string; met: boolean }>;
}

/**
 * Calculate password strength score (0-100)
 */
function calculatePasswordScore(password: string): number {
  let score = 0;

  // Length scoring (0-20 points)
  if (password.length >= 8 && password.length < 12) {
    score += 10;
  } else if (password.length >= 12 && password.length < 16) {
    score += 15;
  } else if (password.length >= 16) {
    score += 20;
  }

  // Character type scoring (0-60 points)
  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;

  // Penalties
  if (/(.)\1{2,}/.test(password)) score -= 10; // Repeated chars
  if (
    /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(
      password,
    )
  ) {
    score -= 10; // Sequential chars
  }

  // Bonuses
  if (password.length >= 16) score += 10;
  if (/[^a-zA-Z0-9]/.test(password) && /[0-9]/.test(password)) score += 5;

  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Determine strength level from score
 */
function getStrengthFromScore(
  score: number,
): "weak" | "medium" | "strong" | "very-strong" {
  if (score < 40) return "weak";
  if (score < 60) return "medium";
  if (score < 80) return "strong";
  return "very-strong";
}

/**
 * Validate password and calculate strength for frontend display
 */
export function validatePasswordStrength(
  password: string,
): PasswordValidationResult {
  const validation = validatePassword(password);
  const score = calculatePasswordScore(password);
  const strength = getStrengthFromScore(score);
  const requirements = getPasswordRequirements(password);

  return {
    isValid: validation.isValid,
    errors: validation.errors,
    strength,
    score,
    requirements,
  };
}

/**
 * Get password strength color class
 */
export function getPasswordStrengthColor(
  strength: PasswordValidationResult["strength"],
): string {
  const colors = {
    weak: "text-red-600",
    medium: "text-yellow-600",
    strong: "text-blue-600",
    "very-strong": "text-green-600",
  };
  return colors[strength] || "text-muted-foreground";
}

/**
 * Get password strength background color for progress bar
 */
export function getPasswordStrengthBgColor(
  strength: PasswordValidationResult["strength"],
): string {
  const colors = {
    weak: "bg-red-500",
    medium: "bg-yellow-500",
    strong: "bg-blue-500",
    "very-strong": "bg-green-500",
  };
  return colors[strength] || "bg-muted";
}
