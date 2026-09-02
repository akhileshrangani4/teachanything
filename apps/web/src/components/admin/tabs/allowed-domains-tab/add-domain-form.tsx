"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Inline "Add Domain" form: collapsed to a button until editing starts.
export function AddDomainForm({
  newDomain,
  onNewDomainChange,
  isAdding,
  isPending,
  onStart,
  onCancel,
  onSubmit,
}: {
  newDomain: string;
  onNewDomainChange: (value: string) => void;
  isAdding: boolean;
  isPending: boolean;
  onStart: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mb-6">
      <div className="flex gap-2">
        {isAdding ? (
          <>
            <Input
              type="text"
              placeholder="Enter domain (e.g., .edu, .de, stanford.edu, gmail.com)"
              value={newDomain}
              onChange={(e) => onNewDomainChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSubmit();
                } else if (e.key === "Escape") {
                  onCancel();
                }
              }}
              autoFocus
              disabled={isPending}
            />
            <Button onClick={onSubmit} disabled={isPending}>
              {isPending ? "Adding..." : "Add"}
            </Button>
            <Button variant="outline" onClick={onCancel} disabled={isPending}>
              Cancel
            </Button>
          </>
        ) : (
          <Button onClick={onStart}>Add Domain</Button>
        )}
      </div>
    </div>
  );
}
