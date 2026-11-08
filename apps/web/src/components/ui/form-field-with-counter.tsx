import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CharacterCounter } from "@/components/ui/character-counter";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface FormFieldWithCounterProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  warningThreshold?: number;
  helperText?: string;
  placeholder?: string;
  required?: boolean;
  type?: "input" | "textarea";
  rows?: number;
  error?: string;
  className?: string;
  showCounter?: boolean;
}

export function FormFieldWithCounter({
  id,
  label,
  value,
  onChange,
  maxLength,
  warningThreshold = 0.9,
  helperText,
  placeholder,
  required = false,
  type = "input",
  rows = 3,
  error,
  className,
  showCounter = true,
}: FormFieldWithCounterProps) {
  const { t } = useTranslation();
  const threshold =
    warningThreshold < 1
      ? Math.floor(maxLength * warningThreshold)
      : warningThreshold;
  const isOverLimit = value.length > maxLength;
  const isWarning = value.length > threshold && !isOverLimit;

  const InputComponent = type === "textarea" ? Textarea : Input;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <Label htmlFor={id} className="text-base font-semibold">
          {label}
          {required && " *"}
        </Label>
        {showCounter && (
          <CharacterCounter
            current={value.length}
            max={maxLength}
            warningThreshold={warningThreshold}
          />
        )}
      </div>
      {helperText && (
        <p className="text-xs text-muted-foreground mb-2">{helperText}</p>
      )}
      <div className="space-y-1">
        <InputComponent
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          className={cn(
            type === "textarea" && "resize-none",
            isOverLimit
              ? "border-destructive focus-visible:ring-destructive"
              : isWarning
                ? "border-orange-500 focus-visible:ring-orange-500"
                : "",
          )}
          {...(type === "textarea" && {
            rows,
            style: { wordBreak: "break-word", overflowWrap: "anywhere" },
          })}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        {isOverLimit && !error && (
          <p className="text-xs text-destructive">
            {t("common.form.exceedsMaxLength", { label, max: maxLength })}
          </p>
        )}
      </div>
    </div>
  );
}
