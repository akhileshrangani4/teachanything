"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { ChatbotSettingsChatbot } from "./settings-draft";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (chatbot.shareToken) {
      navigator.clipboard.writeText(
        `${window.location.origin}/chat/${chatbot.shareToken}`,
      );
      setCopied(true);
      toast.success(t("chatbotSettings.share.linkCopied"));
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4 p-6 bg-muted/30 rounded-lg border">
      <div className="space-y-1">
        <Label className="text-base font-semibold">
          {t("chatbotSettings.share.title")}
        </Label>
        <p className="text-xs text-muted-foreground">
          {chatbot.sharingEnabled
            ? t("chatbotSettings.share.enabledDescription")
            : t("chatbotDetail.share.enableDescription")}
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
              {copied ? t("common.actions.copied") : t("common.actions.copy")}
            </Button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDisableSharing}
            disabled={isDisabling}
          >
            {isDisabling
              ? t("chatbotSettings.disableSharing.disabling")
              : t("chatbotSettings.disableSharing.title")}
          </Button>
        </div>
      ) : (
        <Button
          onClick={onEnableSharing}
          disabled={isGenerating}
          className="w-full sm:w-auto"
        >
          {isGenerating
            ? t("chatbotSettings.share.generating")
            : t("chatbotDetail.share.enable")}
        </Button>
      )}
    </div>
  );
}
