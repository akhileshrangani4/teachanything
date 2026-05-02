"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface EditableNameProps {
  value: string;
  fallback: string;
  ariaLabel: string;
  isSaving: boolean;
  onSave: (value: string) => Promise<unknown>;
  className?: string;
}

export function EditableName({
  value,
  fallback,
  ariaLabel,
  isSaving,
  onSave,
  className,
}: EditableNameProps) {
  const displayValue = value.trim() || fallback;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(displayValue);

  const startEditing = () => {
    setDraft(displayValue);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraft(displayValue);
    setIsEditing(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextValue = draft.trim();
    if (!nextValue) return;
    if (nextValue === displayValue) {
      setIsEditing(false);
      return;
    }
    try {
      await onSave(nextValue);
      setIsEditing(false);
    } catch {
      // Parent mutations show the error toast. Keep the field open for retry.
    }
  };

  if (isEditing) {
    return (
      <form className="flex min-w-0 items-center gap-1" onSubmit={handleSubmit}>
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={ariaLabel}
          maxLength={200}
          className="h-8 min-w-0 text-sm"
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancelEditing();
            }
          }}
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={isSaving || !draft.trim()}
          aria-label="Save name"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={cancelEditing}
          disabled={isSaving}
          aria-label="Cancel rename"
        >
          <X className="h-4 w-4" />
        </Button>
      </form>
    );
  }

  return (
    <div className="group/name flex min-w-0 items-center gap-1">
      <p className={`min-w-0 truncate ${className ?? ""}`}>{displayValue}</p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 opacity-100 sm:opacity-0 sm:group-hover/name:opacity-100"
        onClick={startEditing}
        aria-label={ariaLabel}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
