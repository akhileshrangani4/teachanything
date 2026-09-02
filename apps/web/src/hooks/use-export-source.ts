"use client";

import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/**
 * Builds the JSON export handler for a single crawl source: fetches the
 * export, triggers a browser download and toasts the outcome.
 */
export function useExportSource(crawlSourceId: string, rootUrl: string) {
  const utils = trpc.useUtils();
  return async () => {
    try {
      const data = await utils.crawler.exportJson.fetch({
        crawlSourceId,
      });
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `crawl-${new URL(rootUrl).hostname}-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("JSON exported");
    } catch {
      toast.error("Failed to export JSON");
    }
  };
}
