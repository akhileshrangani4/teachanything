"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/copy-button";
import { Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ShareLinkSectionProps {
  shareToken: string | null;
  sharingEnabled: boolean;
  onEnableSharing: () => void;
  isEnabling?: boolean;
}

export function ShareLinkSection({
  shareToken,
  sharingEnabled,
  onEnableSharing,
  isEnabling = false,
}: ShareLinkSectionProps) {
  const { t } = useTranslation();
  const shareUrl =
    typeof window !== "undefined" && shareToken
      ? `${window.location.origin}/chat/${shareToken}`
      : "";

  if (sharingEnabled && shareToken) {
    return (
      <Card className="mt-6 bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-2">
            <Share2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">
              {t("chatbotDetail.share.title")}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {t("chatbotDetail.share.description")}
          </p>
          <div className="flex gap-2">
            <Input
              value={shareUrl}
              readOnly
              className="font-mono text-sm bg-background"
            />
            <CopyButton
              text={shareUrl}
              successMessage={t("chatbotDetail.share.copied")}
              errorMessage={t("chatbotDetail.share.copyFailed")}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 bg-muted/50 border-dashed">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Share2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">
                {t("chatbotDetail.share.enableTitle")}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("chatbotDetail.share.enableDescription")}
            </p>
          </div>
          <Button onClick={onEnableSharing} disabled={isEnabling} size="sm">
            {isEnabling
              ? t("chatbotDetail.share.enabling")
              : t("chatbotDetail.share.enable")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
