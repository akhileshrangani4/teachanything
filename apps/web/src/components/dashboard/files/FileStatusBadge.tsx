"use client";

import { cn } from "@/lib/utils";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { storedFileErrorMessage } from "@/lib/stored-file-error";

interface ProcessingProgress {
  stage: "downloading" | "extracting" | "chunking" | "embedding" | "storing";
  percentage: number;
  currentChunk?: number;
  totalChunks?: number;
  startedAt?: string;
  lastUpdatedAt?: string;
}

interface FileStatusBadgeProps {
  status: string;
  metadata?: {
    error?: string;
    chunkCount?: number;
    processedAt?: string;
    processingProgress?: ProcessingProgress;
  };
  showProgress?: boolean;
  size?: "sm" | "md";
}

const TIMEOUT_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

function isStuck(progress?: ProcessingProgress): boolean {
  if (!progress?.lastUpdatedAt) return false;
  const lastUpdate = new Date(progress.lastUpdatedAt).getTime();
  const now = Date.now();
  return now - lastUpdate > TIMEOUT_THRESHOLD_MS;
}

export function FileStatusBadge({
  status,
  metadata,
  showProgress = true,
  size = "md",
}: FileStatusBadgeProps) {
  const { t, i18n } = useTranslation();
  const progress = metadata?.processingProgress;
  const stuck = status === "processing" && isStuck(progress);

  // If file is stuck, show warning status
  const displayStatus = stuck ? "stuck" : status;

  const getStatusConfig = () => {
    switch (displayStatus) {
      case "completed":
        return {
          icon: CheckCircle2,
          label: t("files.status.completed"),
          color: "text-green-600",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
        };
      case "failed":
        return {
          icon: XCircle,
          label: t("files.status.failed"),
          color: "text-red-600",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
        };
      case "stuck":
        return {
          icon: AlertTriangle,
          label: t("files.status.stuck"),
          color: "text-amber-600",
          bgColor: "bg-amber-50",
          borderColor: "border-amber-200",
        };
      case "pending":
        return {
          icon: Clock,
          label: t("files.status.pending"),
          color: "text-gray-600",
          bgColor: "bg-gray-50",
          borderColor: "border-gray-200",
        };
      case "processing":
        return {
          icon: Loader2,
          label: t("files.status.processing"),
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-200",
        };
      default:
        return {
          icon: Clock,
          label: status.charAt(0).toUpperCase() + status.slice(1),
          color: "text-gray-600",
          bgColor: "bg-gray-50",
          borderColor: "border-gray-200",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const getTooltipContent = () => {
    if (displayStatus === "stuck") {
      return (
        <div className="space-y-1">
          <p className="font-medium">{t("files.status.stuckTitle")}</p>
          <p className="text-xs">
            {t("files.status.lastUpdated", {
              time: progress?.lastUpdatedAt
                ? new Date(progress.lastUpdatedAt).toLocaleString(i18n.language)
                : t("files.status.unknown"),
            })}
          </p>
          <p className="text-xs">
            {t("files.status.stage", {
              stage: progress?.stage
                ? t(`files.status.stages.${progress.stage}`)
                : t("files.status.unknown"),
            })}
          </p>
          <p className="text-xs text-amber-200">{t("files.status.tryRetry")}</p>
        </div>
      );
    }

    if (displayStatus === "failed" && metadata?.error) {
      return (
        <div className="space-y-1">
          <p className="font-medium">{t("files.status.failedTitle")}</p>
          <p className="text-xs">
            {storedFileErrorMessage(i18n, metadata.error)}
          </p>
        </div>
      );
    }

    if (displayStatus === "completed" && metadata?.chunkCount) {
      return (
        <div className="space-y-1">
          <p className="font-medium">{t("files.status.completedTitle")}</p>
          <p className="text-xs">
            {t("files.status.chunksCreated", { count: metadata.chunkCount })}
          </p>
          {metadata.processedAt && (
            <p className="text-xs">
              {new Date(metadata.processedAt).toLocaleString(i18n.language)}
            </p>
          )}
        </div>
      );
    }

    if (displayStatus === "processing" && progress) {
      return (
        <div className="space-y-1">
          <p className="font-medium">{t("files.status.inProgressTitle")}</p>
          <p className="text-xs">
            {t("files.status.stage", {
              stage: t(`files.status.stages.${progress.stage}`),
            })}
          </p>
          {progress.totalChunks && (
            <p className="text-xs">
              {t("files.status.chunkProgress", {
                current: progress.currentChunk || 0,
                total: progress.totalChunks,
              })}
            </p>
          )}
          <p className="text-xs">
            {t("files.status.progress", {
              progress: progress.percentage / 100,
            })}
          </p>
        </div>
      );
    }

    return null;
  };

  const tooltipContent = getTooltipContent();
  const isSmall = size === "sm";

  const badge = (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        config.bgColor,
        config.borderColor,
        config.color,
        isSmall ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
      )}
    >
      <Icon
        className={cn(
          isSmall ? "h-3 w-3" : "h-3.5 w-3.5",
          displayStatus === "processing" && "animate-spin",
        )}
      />
      <span>{config.label}</span>
    </div>
  );

  if (!showProgress || !progress || displayStatus !== "processing") {
    if (!tooltipContent) {
      return badge;
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Show progress bar for processing files - clean aligned version
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex items-center justify-between gap-3 min-w-[200px]">
              {badge}
              <div className="flex items-center gap-2 flex-shrink-0">
                {progress.stage === "embedding" &&
                  progress.totalChunks &&
                  progress.totalChunks > 0 && (
                    <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                      {progress.currentChunk || 0}/{progress.totalChunks}
                    </span>
                  )}
                <span className="text-xs font-medium text-foreground tabular-nums min-w-[35px] text-right">
                  {t("files.status.percent", {
                    progress: progress.percentage / 100,
                  })}
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, progress.percentage)}%` }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
