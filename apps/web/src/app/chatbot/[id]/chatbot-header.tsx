"use client";

import { Badge } from "@/components/ui/badge";
import { WrappableText } from "@/components/ui/wrappable-text";
import { ShareLinkSection } from "@/components/chat/sharing/ShareLinkSection";

interface ChatbotHeaderProps {
  name: string | null;
  description: string | null;
  model: string;
  sharingEnabled: boolean;
  shareToken: string | null;
  onEnableSharing: () => void;
  isEnabling: boolean;
}

/** Title, description, model badges, and the share-link controls. */
export function ChatbotHeader({
  name,
  description,
  model,
  sharingEnabled,
  shareToken,
  onEnableSharing,
  isEnabling,
}: ChatbotHeaderProps) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-4xl font-bold text-foreground tracking-tight">
          {name}
        </h1>
      </div>
      <p className="text-muted-foreground mt-2 text-lg">
        <WrappableText>{description}</WrappableText>
      </p>
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <Badge>{model}</Badge>
        {sharingEnabled && <Badge variant="outline">Sharing Enabled</Badge>}
      </div>

      {/* Share Link Section */}
      <div className="mt-6">
        <ShareLinkSection
          shareToken={shareToken}
          sharingEnabled={sharingEnabled}
          onEnableSharing={onEnableSharing}
          isEnabling={isEnabling}
        />
      </div>
    </div>
  );
}
