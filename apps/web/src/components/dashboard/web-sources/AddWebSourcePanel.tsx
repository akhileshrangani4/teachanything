"use client";

import { useState } from "react";
import { Link as LinkIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAddWebSource } from "@/hooks/use-add-web-source";
import {
  AddFullWebSourceDialog,
  SingleWebpageForm,
} from "@/components/chatbot/web-sources/WebSourceForms";

/**
 * Header actions for adding a web source. Two clear, separate paths:
 * "Add single page" (one URL) and "Crawl website" (follows links). Sources
 * are created unattached; attach them to chatbots later from the table.
 */
export function AddWebSourcePanel() {
  const [crawlDialogOpen, setCrawlDialogOpen] = useState(false);
  const [singleDialogOpen, setSingleDialogOpen] = useState(false);

  const utils = trpc.useUtils();
  const refreshSources = () => utils.crawler.getAllCrawlSources.invalidate();

  const {
    rootUrl,
    crawlDepth,
    maxPages,
    includePatterns,
    excludePatterns,
    manualUrl,
    setRootUrl,
    setCrawlDepth,
    setMaxPages,
    setIncludePatterns,
    setExcludePatterns,
    setManualUrl,
    submitCrawlSource,
    submitManualUrl,
    isSubmittingCrawlSource,
    isSubmittingManualUrl,
  } = useAddWebSource({
    onAdded: refreshSources,
    onCrawlSourceAdded: () => setCrawlDialogOpen(false),
    onManualUrlAdded: () => setSingleDialogOpen(false),
  });

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Dialog open={singleDialogOpen} onOpenChange={setSingleDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <LinkIcon className="h-4 w-4 mr-2" />
            Add single page
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add a single page</DialogTitle>
            <DialogDescription>
              Adds only this page to your library. The crawler does not follow
              its links.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <SingleWebpageForm
              manualUrl={manualUrl}
              isSubmitting={isSubmittingManualUrl}
              onManualUrlChange={setManualUrl}
              onSubmit={submitManualUrl}
            />
          </div>
        </DialogContent>
      </Dialog>

      <AddFullWebSourceDialog
        open={crawlDialogOpen}
        onOpenChange={setCrawlDialogOpen}
        rootUrl={rootUrl}
        crawlDepth={crawlDepth}
        maxPages={maxPages}
        includePatterns={includePatterns}
        excludePatterns={excludePatterns}
        onRootUrlChange={setRootUrl}
        onCrawlDepthChange={setCrawlDepth}
        onMaxPagesChange={setMaxPages}
        onIncludePatternsChange={setIncludePatterns}
        onExcludePatternsChange={setExcludePatterns}
        onSubmit={submitCrawlSource}
        isSubmitting={isSubmittingCrawlSource}
      />
    </div>
  );
}
