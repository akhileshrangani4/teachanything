"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import type { PasswordValidationResult } from "@/lib/password/password-strength";
import { passwordRuleLabel } from "@/lib/password/password-messages";
import { useTranslation } from "react-i18next";

interface PasswordRequirementsListProps {
  requirements: PasswordValidationResult["requirements"];
}

export function PasswordRequirementsList({
  requirements,
}: PasswordRequirementsListProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 pt-2">
      <p className="text-xs font-semibold text-muted-foreground">
        {t("settings.password.requirements")}
      </p>
      <div className="grid grid-cols-1 gap-1.5">
        {requirements.map((req, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-2 text-xs ${
              req.met ? "text-green-600" : "text-muted-foreground"
            }`}
          >
            {req.met ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            <span>{passwordRuleLabel(t, req.id)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
