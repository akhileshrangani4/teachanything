"use client";

import { Label } from "@/components/ui/label";
import { FormFieldWithCounter } from "@/components/ui/form-field-with-counter";
import { WrappableText } from "@/components/ui/wrappable-text";
import { CharacterCounter } from "@/components/ui/character-counter";
import { VALIDATION_LIMITS } from "@/lib/validation";
import { useTranslation } from "react-i18next";

interface WelcomeMessageFieldProps {
  value: string;
  onChange: (value: string) => void;
  isEditing: boolean;
}

export function WelcomeMessageField({
  value,
  onChange,
  isEditing,
}: WelcomeMessageFieldProps) {
  const { t } = useTranslation();
  const helperText = t("chatbotSettings.welcome.help", { name: "<name>" });

  if (isEditing) {
    return (
      <FormFieldWithCounter
        id="welcomeMessage"
        label={t("chatbotSettings.welcome.label")}
        value={value}
        onChange={onChange}
        maxLength={VALIDATION_LIMITS.WELCOME_MESSAGE_MAX_LENGTH}
        warningThreshold={VALIDATION_LIMITS.WELCOME_MESSAGE_WARNING_THRESHOLD}
        helperText={helperText}
        placeholder={t("chatbotSettings.welcome.placeholder")}
        type="textarea"
        rows={3}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <Label className="text-base font-semibold">
          {t("chatbotSettings.welcome.label")}
        </Label>
        <CharacterCounter
          current={value.length}
          max={VALIDATION_LIMITS.WELCOME_MESSAGE_MAX_LENGTH}
          warningThreshold={VALIDATION_LIMITS.WELCOME_MESSAGE_WARNING_THRESHOLD}
        />
      </div>
      <p className="text-xs text-muted-foreground mb-2">{helperText}</p>
      <div className="px-3 py-2 bg-background rounded-md border">
        <p className="text-sm whitespace-pre-line">
          <WrappableText>
            {value ||
              t("chatbotSettings.welcome.default", {
                message: t("chat.interface.emptyPrompt"),
              })}
          </WrappableText>
        </p>
      </div>
    </div>
  );
}
