"use client";

import { CircleStop, Download, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { isActiveSource } from "../utils";
import { ConfirmDialogContent } from "../ConfirmDialogContent";
import type { CrawlSource } from "./types";
import { useTranslation } from "react-i18next";

// ── Shared row actions (export / recrawl / remove) ───────────────────
export function WebSourceRowActions({
  source,
  isRecrawling,
  isRemoving,
  isStopping,
  onExport,
  onRecrawl,
  onRemove,
  onStop,
}: {
  source: CrawlSource;
  isRecrawling: boolean;
  isRemoving: boolean;
  isStopping: boolean;
  onExport: () => void;
  onRecrawl: () => void;
  onRemove: () => void;
  onStop: () => void;
}) {
  const { t } = useTranslation();
  const isActive = isActiveSource(source);
  return (
    <>
      {isActive && <StopCrawlButton onStop={onStop} isStopping={isStopping} />}
      {source.status === "completed" && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={onExport}
            className="h-8 w-8"
            title={t("webSources.actions.downloadJson")}
          >
            <Download className="h-4 w-4" />
          </Button>
          <RecrawlButton onRecrawl={onRecrawl} isRecrawling={isRecrawling} />
        </>
      )}
      {source.status === "failed" && (
        <RecrawlButton
          onRecrawl={onRecrawl}
          isRecrawling={isRecrawling}
          title={t("common.actions.retry")}
        />
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isRemoving}
            title={t("webSources.actions.removeFromChatbot")}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </AlertDialogTrigger>
        <ConfirmDialogContent
          title={t("webSources.actions.removeFromChatbot")}
          description={t("webSources.actions.removeDescription")}
          cancelLabel={t("common.actions.cancel")}
          confirmLabel={t("webSources.actions.removeFromChatbot")}
          onConfirm={onRemove}
        />
      </AlertDialog>
    </>
  );
}

// Lets the user abandon a crawl that is running long or was started by mistake.
function StopCrawlButton({
  onStop,
  isStopping,
}: {
  onStop: () => void;
  isStopping: boolean;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={isStopping}
          title={t("webSources.actions.stopCrawl")}
        >
          <CircleStop className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <ConfirmDialogContent
        title={t("webSources.actions.stopCrawl")}
        description={t("webSources.actions.stopDescriptionChatbot")}
        cancelLabel={t("webSources.actions.keepCrawling")}
        confirmLabel={t("webSources.actions.stopCrawl")}
        onConfirm={onStop}
      />
    </AlertDialog>
  );
}

function RecrawlButton({
  onRecrawl,
  isRecrawling,
  title = "Re-crawl",
}: {
  onRecrawl: () => void;
  isRecrawling: boolean;
  title?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onRecrawl}
      disabled={isRecrawling}
      className="h-8 w-8"
      title={title}
    >
      <RefreshCw className={`h-4 w-4 ${isRecrawling ? "animate-spin" : ""}`} />
    </Button>
  );
}
