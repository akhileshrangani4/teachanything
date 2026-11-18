"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { validateAuthorName } from "../utils/author-name-validation";

interface AuthorNameEditorProps {
  chatbotId: string;
  customAuthorName: string | null;
  ownerName: string | null;
  onSaved: () => void;
}

/**
 * The display name shown as a chatbot's author. Admins can change it only
 * on chatbots they created themselves (the server enforces this too).
 */
export function AuthorNameEditor({
  chatbotId,
  customAuthorName,
  ownerName,
  onSaved,
}: AuthorNameEditorProps) {
  const [value, setValue] = useState(customAuthorName ?? "");
  const [error, setError] = useState<string | null>(null);
  const updateAuthorName = trpc.admin.updateAuthorName.useMutation({
    onSuccess: () => {
      onSaved();
      toast.success("Author name updated");
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const save = () => {
    const validationError = validateAuthorName(value);
    setError(validationError);
    if (validationError) return;
    updateAuthorName.mutate({ chatbotId, authorName: value.trim() || null });
  };

  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={ownerName ?? "Unknown"}
          maxLength={100}
          disabled={updateAuthorName.isPending}
          className="h-9"
          aria-label="Author name"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={updateAuthorName.isPending}
        >
          Save
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Leave empty to show the owner&apos;s name.
        </p>
      )}
    </form>
  );
}
