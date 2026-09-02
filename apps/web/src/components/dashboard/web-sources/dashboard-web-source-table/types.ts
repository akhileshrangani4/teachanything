import type { RouterOutputs } from "@/lib/trpc";
import type { WebSourceSortBy } from "@/components/data-table";

export type DashboardSource =
  RouterOutputs["crawler"]["getAllCrawlSources"]["sources"][number];

export type Chatbot = { id: string; name: string };

// getAllCrawlSources does not return per-status page counts, so the dashboard
// progress bar renders from status alone (counts zeroed).
export const ZERO_PAGE_COUNTS = {
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  blocked: 0,
  skipped: 0,
} as const;

// Sortable subset of WebSourceSortBy supported on this page.
export type DashboardSortBy = Extract<
  WebSourceSortBy,
  "name" | "status" | "lastCrawledAt" | "createdAt"
>;

// ── Per-source props shared by desktop and mobile ────────────────────
export interface RowProps {
  source: DashboardSource;
  chatbots: Chatbot[];
  isSelected: boolean;
  onToggleSelect: (sourceId: string) => void;
  isExpanded: boolean;
  onToggleExpand: (sourceId: string) => void;
  onAttach: (sourceId: string, chatbotId: string) => void;
  onDetach: (sourceId: string, chatbotId: string) => void;
  isAttaching: boolean;
  onRecrawl: (sourceId: string) => void;
  onDelete: (sourceId: string) => void;
  onStop: (sourceId: string) => void;
  onToggleEnabled: (sourceId: string, enabled: boolean) => void;
  onRename: (sourceId: string, name: string) => Promise<unknown>;
  isRecrawling: boolean;
  isDeleting: boolean;
  isStopping: boolean;
  isTogglingEnabled: boolean;
  isRenaming: boolean;
}
