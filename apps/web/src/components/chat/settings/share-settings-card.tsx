"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { ChatbotSettingsChatbot } from "./settings-draft";

interface ShareSettingsCardProps {
  chatbot: Pick<ChatbotSettingsChatbot, "shareToken" | "sharingEnabled">;
  isGenerating: boolean;
  isDisabling: boolean;
  onEnableSharing: () => void;
  onDisableSharing: () => void;
}

export function ShareSettingsCard({
  chatbot,
  isGenerating,
  isDisabling,
  onEnableSharing,
  onDisableSharing,
}: ShareSettingsCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (chatbot.shareToken) {
      navigator.clipboard.writeText(
        `${window.location.origin}/chat/${chatbot.shareToken}`,
      );
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4 p-6 bg-muted/30 rounded-lg border">
      <div className="space-y-1">
        <Label className="text-base font-semibold">Share Settings</Label>
        <p className="text-xs text-muted-foreground">
          {chatbot.sharingEnabled
            ? "Your chatbot is publicly accessible via the link below"
            : "Enable sharing to generate a public link for your chatbot"}
        </p>
      </div>

      {chatbot.sharingEnabled && chatbot.shareToken ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={`${window.location.origin}/chat/${chatbot.shareToken}`}
              readOnly
              className="font-mono text-sm bg-background"
            />
            <Button
              variant="outline"
              onClick={handleCopy}
              disabled={copied}
              className="shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDisableSharing}
            disabled={isDisabling}
          >
            {isDisabling ? "Disabling..." : "Disable Sharing"}
          </Button>
        </div>
      ) : (
        <Button
          onClick={onEnableSharing}
          disabled={isGenerating}
          className="w-full sm:w-auto"
        >
          {isGenerating ? "Generating..." : "Enable Sharing"}
        </Button>
      )}
    </div>
  );
}
