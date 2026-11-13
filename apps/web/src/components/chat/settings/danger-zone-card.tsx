"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface DangerZoneCardProps {
  isDeleting: boolean;
  onDelete: () => void;
}

export function DangerZoneCard({ isDeleting, onDelete }: DangerZoneCardProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4 p-6 bg-destructive/5 rounded-lg border border-destructive/20">
      <div className="space-y-1">
        <Label className="text-base font-semibold text-destructive">
          {t("chatbotSettings.dangerZone.title")}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t("chatbotSettings.dangerZone.description")}
        </p>
      </div>

      <Button
        variant="destructive"
        onClick={onDelete}
        disabled={isDeleting}
        className="w-full sm:w-auto"
      >
        <Trash2 className="h-4 w-4 mr-2" />
        {t("chatbots.delete.title")}
      </Button>
    </div>
  );
}
