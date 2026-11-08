"use client";

import { Globe, Link as LinkIcon, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CRAWL_SOURCES_PER_HOUR,
  MANUAL_URLS_PER_HOUR,
} from "@/lib/constants/rate-limits";
import { useTranslation } from "react-i18next";

export function AddFullWebSourceDialog({
  open,
  onOpenChange,
  rootUrl,
  crawlDepth,
  maxPages,
  includePatterns,
  excludePatterns,
  onRootUrlChange,
  onCrawlDepthChange,
  onMaxPagesChange,
  onIncludePatternsChange,
  onExcludePatternsChange,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rootUrl: string;
  crawlDepth: number;
  maxPages: number;
  includePatterns: string;
  excludePatterns: string;
  onRootUrlChange: (value: string) => void;
  onCrawlDepthChange: (value: number) => void;
  onMaxPagesChange: (value: number) => void;
  onIncludePatternsChange: (value: string) => void;
  onExcludePatternsChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t("webSources.add.addFullSource")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("webSources.add.addFullSource")}</DialogTitle>
          <DialogDescription>
            {t("webSources.add.fullSourceDescription", {
              limit: CRAWL_SOURCES_PER_HOUR,
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rootUrl">{t("webSources.add.websiteUrl")}</Label>
            <Input
              id="rootUrl"
              placeholder="https://cs101.university.edu"
              value={rootUrl}
              onChange={(event) => onRootUrlChange(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="crawlDepth">
                {t("webSources.add.crawlDepth")}
              </Label>
              <Input
                id="crawlDepth"
                type="number"
                min={1}
                max={5}
                value={crawlDepth}
                onChange={(event) =>
                  onCrawlDepthChange(parseInt(event.target.value) || 3)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxPages">{t("webSources.add.maxPages")}</Label>
              <Input
                id="maxPages"
                type="number"
                min={1}
                max={500}
                value={maxPages}
                onChange={(event) =>
                  onMaxPagesChange(parseInt(event.target.value) || 100)
                }
              />
            </div>
          </div>
          <PatternInput
            id="includePatterns"
            label={t("webSources.add.includePatterns")}
            value={includePatterns}
            placeholder="/lectures/*, /syllabus"
            helpText={t("webSources.add.includeHelp")}
            onChange={onIncludePatternsChange}
          />
          <PatternInput
            id="excludePatterns"
            label={t("webSources.add.excludePatterns")}
            value={excludePatterns}
            placeholder="/admin/*, /login"
            helpText={t("webSources.add.excludeHelp")}
            onChange={onExcludePatternsChange}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.actions.cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={!rootUrl || isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("webSources.add.startCrawl")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SingleWebpageForm({
  manualUrl,
  isSubmitting,
  onManualUrlChange,
  onSubmit,
}: {
  manualUrl: string;
  isSubmitting: boolean;
  onManualUrlChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1 space-y-1">
        <Input
          placeholder={t("webSources.add.singleUrlPlaceholder")}
          value={manualUrl}
          onChange={(event) => onManualUrlChange(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && onSubmit()}
        />
        <p className="text-xs text-muted-foreground">
          {t("webSources.add.singleLimit", { limit: MANUAL_URLS_PER_HOUR })}
        </p>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={onSubmit}
              disabled={!manualUrl || isSubmitting}
              className="sm:w-auto"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LinkIcon className="h-4 w-4" />
              )}
              {t("webSources.add.addSingleWebpage")}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t("webSources.add.addSingleTooltip")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export function WebSourcesSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyWebSourcesState() {
  const { t } = useTranslation();
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p className="text-lg font-medium">{t("webSources.page.emptyTitle")}</p>
      <p className="text-sm mt-1">
        {t("webSources.chatbotTab.emptyDescription")}
      </p>
    </div>
  );
}

function PatternInput({
  id,
  label,
  value,
  placeholder,
  helpText,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  helpText: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="text-xs text-muted-foreground">{helpText}</p>
    </div>
  );
}
