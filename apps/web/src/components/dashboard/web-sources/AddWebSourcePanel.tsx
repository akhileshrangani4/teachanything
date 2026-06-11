"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AddFullWebSourceDialog,
  SingleWebpageForm,
} from "@/components/chatbot/web-sources/WebSourceForms";
import {
  getFriendlyError,
  normalizeUrl,
  parsePatternList,
} from "@/components/chatbot/web-sources/utils";

const NO_CHATBOT = "__none__";

interface AddWebSourcePanelProps {
  chatbots: Array<{ id: string; name: string }>;
}

export function AddWebSourcePanel({ chatbots }: AddWebSourcePanelProps) {
  const [chatbotId, setChatbotId] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
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
      setAddDialogOpen(false);
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
      ...(chatbotId ? { chatbotId } : {}),
      rootUrl: normalizeUrl(rootUrl),
      crawlDepth,
      maxPages,
      includePatterns: parsePatternList(includePatterns),
      excludePatterns: parsePatternList(excludePatterns),
    });
  };

  const handleAddManualUrl = () => {
    if (!manualUrl) return;
    addManualUrl.mutate({
      ...(chatbotId ? { chatbotId } : {}),
      url: normalizeUrl(manualUrl),
    });
  };

  return (
    <Card className="border border-border/60 bg-card shadow-xs">
      <CardHeader>
        <CardTitle className="text-lg">Add a web source</CardTitle>
        <CardDescription>
          Crawl a website or add a single page. Attach it to chatbots anytime,
          just like uploading a file.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 sm:max-w-xs">
          <Label htmlFor="chatbot-select">Add to chatbot (optional)</Label>
          <Select
            value={chatbotId || NO_CHATBOT}
            onValueChange={(v) => setChatbotId(v === NO_CHATBOT ? "" : v)}
          >
            <SelectTrigger id="chatbot-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CHATBOT}>No chatbot (add later)</SelectItem>
              {chatbots.map((chatbot) => (
                <SelectItem key={chatbot.id} value={chatbot.id}>
                  {chatbot.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <SingleWebpageForm
              manualUrl={manualUrl}
              isSubmitting={addManualUrl.isPending}
              onManualUrlChange={setManualUrl}
              onSubmit={handleAddManualUrl}
            />
          </div>
          <AddFullWebSourceDialog
            open={addDialogOpen}
            onOpenChange={setAddDialogOpen}
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
      </CardContent>
    </Card>
  );
}
