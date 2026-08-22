"use client";

import { CircleStop, Download, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { isActiveSource } from "../utils";
import { ConfirmDialogContent } from "../ConfirmDialogContent";
import type { CrawlSource } from "./types";

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
            title="Download JSON"
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
          title="Retry"
        />
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isRemoving}
            title="Remove from chatbot"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </AlertDialogTrigger>
        <ConfirmDialogContent
          title="Remove from chatbot"
          description="Remove this web source from this chatbot? Its content stays available to attach again."
          cancelLabel="Cancel"
          confirmLabel="Remove from chatbot"
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
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={isStopping}
          title="Stop crawl"
        >
          <CircleStop className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <ConfirmDialogContent
        title="Stop crawl"
        description="Stop this crawl now. Pages already crawled are kept; the rest are skipped. You can re-crawl or remove the source afterwards."
        cancelLabel="Keep crawling"
        confirmLabel="Stop crawl"
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
