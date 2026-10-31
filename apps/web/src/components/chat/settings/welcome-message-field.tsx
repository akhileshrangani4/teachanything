"use client";

import { Label } from "@/components/ui/label";
import { FormFieldWithCounter } from "@/components/ui/form-field-with-counter";
import { WrappableText } from "@/components/ui/wrappable-text";
import { CharacterCounter } from "@/components/ui/character-counter";
import { VALIDATION_LIMITS } from "@/lib/validation";
import { DEFAULT_WELCOME_MESSAGE } from "@/lib/chat/helpers";

const HELPER_TEXT =
  'Shown to students under "Welcome to <name>!" before they send their first message. Leave blank to use the default greeting.';

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
  if (isEditing) {
    return (
      <FormFieldWithCounter
        id="welcomeMessage"
        label="Welcome Message"
        value={value}
        onChange={onChange}
        maxLength={VALIDATION_LIMITS.WELCOME_MESSAGE_MAX_LENGTH}
        warningThreshold={VALIDATION_LIMITS.WELCOME_MESSAGE_WARNING_THRESHOLD}
        helperText={HELPER_TEXT}
        placeholder="e.g. Hello, I am an AI tutor trained on the content of this course. How can I help you?"
        type="textarea"
        rows={3}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <Label className="text-base font-semibold">Welcome Message</Label>
        <CharacterCounter
          current={value.length}
          max={VALIDATION_LIMITS.WELCOME_MESSAGE_MAX_LENGTH}
          warningThreshold={VALIDATION_LIMITS.WELCOME_MESSAGE_WARNING_THRESHOLD}
        />
      </div>
      <p className="text-xs text-muted-foreground mb-2">{HELPER_TEXT}</p>
      <div className="px-3 py-2 bg-background rounded-md border">
        <p className="text-sm whitespace-pre-line">
          <WrappableText>
            {value || `Default: ${DEFAULT_WELCOME_MESSAGE}`}
          </WrappableText>
        </p>
      </div>
    </div>
  );
}
