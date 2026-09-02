import type { RouterOutputs } from "@/lib/trpc";

export type CrawlSource = RouterOutputs["crawler"]["getCrawlSources"][number];

// ── Per-source props shared by desktop and mobile ────────────────────
export interface WebSourceRowProps {
  source: CrawlSource;
  showCheckbox?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (sourceId: string) => void;
  isExpanded?: boolean;
  onToggleExpand?: (sourceId: string) => void;
  onRecrawl: (sourceId: string) => void;
  onRemove: (sourceId: string) => void;
  onStop: (sourceId: string) => void;
  onToggleEnabled: (sourceId: string, enabled: boolean) => void;
  onRename: (sourceId: string, name: string) => Promise<unknown>;
  isRecrawling?: boolean;
  isRemoving?: boolean;
  isStopping?: boolean;
  isTogglingEnabled?: boolean;
  isRenaming?: boolean;
}
