"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { RouterOutputs } from "@/lib/trpc";
import { toggleAllInSet, toggleInSet } from "@/lib/selection";
import { runSequentially } from "@/lib/sequential-actions";

type CrawlSource = RouterOutputs["crawler"]["getCrawlSources"][number];

/**
 * Selection + expansion state for the web-source list, including bulk
 * removal of the currently checked sources.
 */
export function useSourceSelection({
  allSources,
  pagedSources,
  removeOne,
}: {
  allSources: CrawlSource[];
  pagedSources: CrawlSource[];
  removeOne: (crawlSourceId: string) => Promise<unknown>;
}): {
  expandedSources: Set<string>;
  selectedSources: Set<string>;
  toggleExpanded: (sourceId: string) => void;
  handleToggleSelect: (sourceId: string) => void;
  handleSelectAll: () => void;
  handleRemoveSelected: () => Promise<void>;
} {
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    new Set(),
  );
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set(),
  );

  // Drop selections for sources that are no longer present.
  useEffect(() => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of prev) {
        if (!allSources.some((s) => s.id === id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [allSources]);

  const toggleExpanded = (sourceId: string) => {
    setExpandedSources((prev) => toggleInSet(prev, sourceId));
  };

  const handleToggleSelect = (sourceId: string) => {
    setSelectedSources((prev) => toggleInSet(prev, sourceId));
  };

  const handleSelectAll = () => {
    if (pagedSources.length === 0) return;
    setSelectedSources((prev) =>
      toggleAllInSet(
        prev,
        pagedSources.map((s) => s.id),
      ),
    );
  };

  const handleRemoveSelected = async () => {
    const ids = Array.from(selectedSources);
    await runSequentially(
      ids,
      (crawlSourceId) => removeOne(crawlSourceId),
      (crawlSourceId) => `Failed to remove source ${crawlSourceId}`,
    );
    setSelectedSources(new Set());
    toast.success(
      `${ids.length} web source${ids.length !== 1 ? "s" : ""} removed from chatbot`,
    );
  };

  return {
    expandedSources,
    selectedSources,
    toggleExpanded,
    handleToggleSelect,
    handleSelectAll,
    handleRemoveSelected,
  };
}
