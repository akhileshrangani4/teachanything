"use client";

import {
  getPasswordStrengthColor,
  getPasswordStrengthBgColor,
  type PasswordValidationResult,
} from "@/lib/password/password-strength";
import { passwordStrengthLabel } from "@/lib/password/password-messages";
import { useTranslation } from "react-i18next";

interface PasswordStrengthIndicatorProps {
  validation: PasswordValidationResult;
}

export function PasswordStrengthIndicator({
  validation,
}: PasswordStrengthIndicatorProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {t("settings.password.strength")}
        </span>
        <span className={getPasswordStrengthColor(validation.strength)}>
          {passwordStrengthLabel(t, validation.strength)}
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthBgColor(validation.strength)}`}
          style={{ width: `${validation.score}%` }}
        />
      </div>
    </div>
  );
}
