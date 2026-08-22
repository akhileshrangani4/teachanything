import type { CSSProperties } from "react";
import type { RouterOutputs } from "@/lib/trpc";
import type { ExportFormat } from "@/lib/export-conversations";

export type ConversationRow =
  RouterOutputs["analytics"]["getConversationsList"]["conversations"][number];

export type SortBy = "recent" | "mostMessages" | "longestDuration";

// Shared shell classes so list view and detail view render at identical
// dimensions. Keeps tab-internal navigation from jumping the layout. The
// vertical offset (space above the panel: navbar + tabs + padding) is
// exposed as a CSS var so future chrome changes touch one place.
export const PANEL_OFFSET = "14rem";
export const PANEL_STYLE = {
  "--panel-offset": PANEL_OFFSET,
} as CSSProperties;
export const PANEL_SHELL =
  "flex flex-col h-[calc(100vh-var(--panel-offset))] min-h-[500px] max-h-[800px]";
export const PANEL_CONTENT = "flex flex-1 min-h-0 flex-col gap-4";
// Approx height of a single conversation row (padding + two lines).
// Used to auto-size page limit so rows fill the available panel.
export const ROW_HEIGHT_PX = 68;
export const MIN_LIMIT = 5;
export const MAX_LIMIT = 50;

// Export format order is fixed here so the README/bundle always lists files
// consistently regardless of the order the professor toggles the checkboxes.
export const EXPORT_FORMAT_OPTIONS: Array<{
  value: ExportFormat;
  label: string;
  description: string;
}> = [
  {
    value: "html",
    label: "Visual transcript (HTML)",
    description: "Open in a browser — chat-style, easy to read.",
  },
  {
    value: "csv",
    label: "Spreadsheet (CSV)",
    description: "Open in Excel / Google Sheets for analysis.",
  },
  {
    value: "text",
    label: "Plain text (TXT)",
    description: "Portable transcript for any text editor.",
  },
];

export const ALL_EXPORT_FORMATS: ExportFormat[] = EXPORT_FORMAT_OPTIONS.map(
  (o) => o.value,
);
