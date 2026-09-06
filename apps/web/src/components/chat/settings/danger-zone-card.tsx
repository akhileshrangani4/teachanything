"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

interface DangerZoneCardProps {
  isDeleting: boolean;
  onDelete: () => void;
}

export function DangerZoneCard({ isDeleting, onDelete }: DangerZoneCardProps) {
  return (
    <div className="space-y-4 p-6 bg-destructive/5 rounded-lg border border-destructive/20">
      <div className="space-y-1">
        <Label className="text-base font-semibold text-destructive">
          Danger Zone
        </Label>
        <p className="text-xs text-muted-foreground">
          Permanently delete this chatbot and all associated data
        </p>
      </div>

      <Button
        variant="destructive"
        onClick={onDelete}
        disabled={isDeleting}
        className="w-full sm:w-auto"
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Delete Chatbot
      </Button>
    </div>
  );
}
