"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import {
  AddFullWebSourceDialog,
  SingleWebpageForm,
} from "@/components/chatbot/web-sources/WebSourceForms";
import {
  getFriendlyError,
  normalizeUrl,
  parsePatternList,
} from "@/components/chatbot/web-sources/utils";

/**
 * Header actions for adding a web source. Two clear, separate paths:
 * "Add single page" (one URL) and "Crawl website" (follows links). Sources
 * are created unattached; attach them to chatbots later from the table.
 */
export function AddWebSourcePanel() {
  const [crawlDialogOpen, setCrawlDialogOpen] = useState(false);
  const [singleDialogOpen, setSingleDialogOpen] = useState(false);
  const [rootUrl, setRootUrl] = useState("");
  const [crawlDepth, setCrawlDepth] = useState(3);
  const [maxPages, setMaxPages] = useState(100);
  const [includePatterns, setIncludePatterns] = useState("");
  const [excludePatterns, setExcludePatterns] = useState("");
  const [manualUrl, setManualUrl] = useState("");

  const utils = trpc.useUtils();
  const refreshSources = () => utils.crawler.getAllCrawlSources.invalidate();

  const addCrawlSource = trpc.crawler.addCrawlSource.useMutation({
    onSuccess: () => {
      refreshSources();
      setCrawlDialogOpen(false);
      setRootUrl("");
      setCrawlDepth(3);
      setMaxPages(100);
      setIncludePatterns("");
      setExcludePatterns("");
      toast.success("Crawl started");
    },
    onError: (error) => {
      toast.error("Failed to start crawl", {
        description: getFriendlyError(error),
      });
    },
  });

  const addManualUrl = trpc.crawler.addManualUrl.useMutation({
    onSuccess: () => {
      refreshSources();
      setManualUrl("");
      setSingleDialogOpen(false);
      toast.success("URL added");
    },
    onError: (error) => {
      toast.error("Failed to add URL", {
        description: getFriendlyError(error),
      });
    },
  });

  const handleAddSource = () => {
    addCrawlSource.mutate({
      rootUrl: normalizeUrl(rootUrl),
      crawlDepth,
      maxPages,
      includePatterns: parsePatternList(includePatterns),
      excludePatterns: parsePatternList(excludePatterns),
    });
  };

  const handleAddManualUrl = () => {
    if (!manualUrl) return;
    addManualUrl.mutate({ url: normalizeUrl(manualUrl) });
  };

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
              isSubmitting={addManualUrl.isPending}
              onManualUrlChange={setManualUrl}
              onSubmit={handleAddManualUrl}
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
        onSubmit={handleAddSource}
        isSubmitting={addCrawlSource.isPending}
      />
    </div>
  );
}
