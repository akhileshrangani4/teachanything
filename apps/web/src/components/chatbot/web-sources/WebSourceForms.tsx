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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Full Web Source
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Full Web Source</DialogTitle>
          <DialogDescription>
            Enter a starting URL. The crawler follows links from that page
            within the limits you set.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rootUrl">Website URL</Label>
            <Input
              id="rootUrl"
              placeholder="https://cs101.university.edu"
              value={rootUrl}
              onChange={(event) => onRootUrlChange(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="crawlDepth">Crawl Depth</Label>
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
              <Label htmlFor="maxPages">Max Pages</Label>
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
            label="Include URL patterns"
            value={includePatterns}
            placeholder="/lectures/*, /syllabus"
            helpText="Optional. Only crawl matching paths, such as /lectures/*. The * means any characters."
            onChange={onIncludePatternsChange}
          />
          <PatternInput
            id="excludePatterns"
            label="Exclude URL patterns"
            value={excludePatterns}
            placeholder="/admin/*, /login"
            helpText="Optional. Skip matching paths, such as /login or /admin/*."
            onChange={onExcludePatternsChange}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!rootUrl || isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Start Crawl
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
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="flex-1">
        <Input
          placeholder="Add a single page URL..."
          value={manualUrl}
          onChange={(event) => onManualUrlChange(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && onSubmit()}
        />
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
              Add Single Webpage
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Adds only this page. It will not follow links.
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
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p className="text-lg font-medium">No web sources yet</p>
      <p className="text-sm mt-1">
        Add a website URL to crawl or paste a single page URL above.
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
