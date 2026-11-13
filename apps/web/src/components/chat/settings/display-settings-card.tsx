"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";

interface DisplaySettingsCardProps {
  showSources: boolean;
  isToggling: boolean;
  onToggle: (checked: boolean) => void;
}

export function DisplaySettingsCard({
  showSources,
  isToggling,
  onToggle,
}: DisplaySettingsCardProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4 p-6 bg-muted/30 rounded-lg border">
      <div className="space-y-1">
        <Label className="text-base font-semibold">
          {t("chatbotSettings.display.title")}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t("chatbotSettings.display.description")}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="showSources" className="text-sm font-medium">
            {t("chatbotSettings.display.showSources")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("chatbotSettings.display.showSourcesHelp")}
          </p>
        </div>
        <Switch
          id="showSources"
          checked={showSources}
          onCheckedChange={onToggle}
          disabled={isToggling}
        />
      </div>
    </div>
  );
}
