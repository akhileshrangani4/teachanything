"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  getFriendlyError,
  normalizeUrl,
  parsePatternList,
} from "@/components/chatbot/web-sources/utils";

interface UseAddWebSourceOptions {
  /**
   * When set, created sources are attached to this chatbot immediately.
   * Omit on dashboard pages where sources are created unattached.
   */
  chatbotId?: string;
  /** Refreshes the source list after an add succeeds. */
  onAdded: () => void;
  /** Runs after a successful crawl add, before fields reset (e.g. close dialog). */
  onCrawlSourceAdded?: () => void;
  /** Runs after a successful manual-URL add, after its field reset (e.g. close dialog). */
  onManualUrlAdded?: () => void;
}

/**
 * Owns the add-source form state (crawl form + single-page form), the
 * corresponding mutations and their success/error toasts + field resets.
 */
export function useAddWebSource({
  chatbotId,
  onAdded,
  onCrawlSourceAdded,
  onManualUrlAdded,
}: UseAddWebSourceOptions) {
  const [rootUrl, setRootUrl] = useState("");
  const [crawlDepth, setCrawlDepth] = useState(3);
  const [maxPages, setMaxPages] = useState(100);
  const [includePatterns, setIncludePatterns] = useState("");
  const [excludePatterns, setExcludePatterns] = useState("");
  const [manualUrl, setManualUrl] = useState("");

  const resetCrawlFields = () => {
    setRootUrl("");
    setCrawlDepth(3);
    setMaxPages(100);
    setIncludePatterns("");
    setExcludePatterns("");
  };

  const addCrawlSource = trpc.crawler.addCrawlSource.useMutation({
    onSuccess: () => {
      onAdded();
      onCrawlSourceAdded?.();
      resetCrawlFields();
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
      onAdded();
      setManualUrl("");
      onManualUrlAdded?.();
      toast.success("URL added");
    },
    onError: (error) => {
      toast.error("Failed to add URL", {
        description: getFriendlyError(error),
      });
    },
  });

  const submitCrawlSource = () => {
    const input = {
      rootUrl: normalizeUrl(rootUrl),
      crawlDepth,
      maxPages,
      includePatterns: parsePatternList(includePatterns),
      excludePatterns: parsePatternList(excludePatterns),
    };
    addCrawlSource.mutate(chatbotId ? { ...input, chatbotId } : input);
  };

  const submitManualUrl = () => {
    if (!manualUrl) return;
    addManualUrl.mutate(
      chatbotId
        ? { chatbotId, url: normalizeUrl(manualUrl) }
        : { url: normalizeUrl(manualUrl) },
    );
  };

  return {
    rootUrl,
    setRootUrl,
    crawlDepth,
    setCrawlDepth,
    maxPages,
    setMaxPages,
    includePatterns,
    setIncludePatterns,
    excludePatterns,
    setExcludePatterns,
    manualUrl,
    setManualUrl,
    submitCrawlSource,
    submitManualUrl,
    isSubmittingCrawlSource: addCrawlSource.isPending,
    isSubmittingManualUrl: addManualUrl.isPending,
  };
}
