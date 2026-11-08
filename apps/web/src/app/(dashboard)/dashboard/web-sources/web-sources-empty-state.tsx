"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";

/** Empty state shown when no web sources exist and nothing is filtered. */
export function WebSourcesEmptyState({
  hasChatbots,
}: {
  hasChatbots: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
      <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p className="text-lg font-medium text-foreground">
        {t("webSources.page.emptyTitle")}
      </p>
      <p className="text-sm mt-1 max-w-xl mx-auto">
        <Trans
          i18nKey="webSources.page.emptyDescription"
          components={{ b: <span className="font-medium text-foreground" /> }}
        />
        {!hasChatbots && ` ${t("webSources.page.emptyNoChatbots")}`}
      </p>
      {!hasChatbots && (
        <Button asChild variant="outline" className="mt-5">
          <Link href="/dashboard/chatbots">
            {t("webSources.page.createChatbot")}
          </Link>
        </Button>
      )}
    </div>
  );
}
