"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
  return (
    <div className="space-y-4 p-6 bg-muted/30 rounded-lg border">
      <div className="space-y-1">
        <Label className="text-base font-semibold">Display Settings</Label>
        <p className="text-xs text-muted-foreground">
          Configure how messages are displayed in the chat
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="showSources" className="text-sm font-medium">
            Show Sources
          </Label>
          <p className="text-xs text-muted-foreground">
            Display source file citations below assistant messages
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
