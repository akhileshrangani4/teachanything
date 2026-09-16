"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

import { SourceBadge } from "@/components/ui/source-badge";
import type { GroupedSource } from "@/lib/message-sources";

/**
 * How many source badges show before the rest are folded away.
 *
 * Five fits one line on a phone and keeps the footer subordinate to the answer,
 * which is the whole point of #397. It is not a limit on what was cited: the
 * rest are one tap away and the count is always visible, so nothing is hidden,
 * only deferred.
 */
const VISIBLE_SOURCE_LIMIT = 5;

/**
 * The "Sources:" footer under an assistant message.
 *
 * Previously every citation rendered as its own badge with no cap, so a reply
 * drawing on several pages across several files produced a source block taller
 * than the answer, burying it (#397). Grouping by file happens upstream in
 * `groupSourcesByFile`; this caps what that leaves.
 */
export function SourceList({ sources }: { sources: GroupedSource[] }) {
  const [expanded, setExpanded] = useState(false);

  if (sources.length === 0) return null;

  const hiddenCount = sources.length - VISIBLE_SOURCE_LIMIT;
  const isCapped = hiddenCount > 0 && !expanded;
  const visible = isCapped ? sources.slice(0, VISIBLE_SOURCE_LIMIT) : sources;

  return (
    <div className="mt-2 md:mt-3 flex flex-wrap items-center gap-1.5 md:gap-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium">Sources:</span>
      </div>

      {visible.map((source) => (
        <SourceBadge
          // File name is the group key, so it is unique across this list.
          key={source.fileName}
          source={source}
          pageNumbers={source.pageNumbers}
          variant="outline"
          showSimilarityTooltip
          className="text-xs font-normal"
        />
      ))}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          {expanded ? "Show fewer" : `+${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}
