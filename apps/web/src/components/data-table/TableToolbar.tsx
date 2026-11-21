"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface TableToolbarProps {
  /** Current search input value (immediate, not debounced) */
  searchValue: string;
  /** Callback when search changes */
  onSearchChange: (value: string) => void;
  /** Placeholder text for search input */
  placeholder?: string;
  /** Total items count (used for "Showing X of Y") */
  totalCount?: number;
  /** Current visible items count */
  visibleCount?: number;
  /** Label for items (e.g., "user", "chatbot") */
  itemLabel?: string;
  /** Translated count text; replaces the English counts admin pages use. */
  summary?: string;
  /** Whether data is currently being fetched */
  isLoading?: boolean;
  /** Additional className for the container */
  className?: string;
}

export function TableToolbar({
  searchValue,
  onSearchChange,
  placeholder,
  totalCount,
  visibleCount,
  itemLabel = "item",
  summary,
  isLoading = false,
  className,
}: TableToolbarProps) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center gap-3 mb-4",
        className,
      )}
    >
      <div className="relative w-full sm:max-w-sm">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center">
          {isLoading ? (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <Input
          type="text"
          placeholder={placeholder ?? t("common.table.searchPlaceholder")}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchValue && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => onSearchChange("")}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{t("common.table.clearSearch")}</span>
          </Button>
        )}
      </div>
      {summary ? (
        <p className="text-sm text-muted-foreground whitespace-nowrap">
          {summary}
        </p>
      ) : (
        typeof totalCount === "number" &&
        typeof visibleCount === "number" && (
          <p className="text-sm text-muted-foreground whitespace-nowrap">
            Showing {visibleCount} of {totalCount} {itemLabel}
            {totalCount !== 1 ? "s" : ""}
          </p>
        )
      )}
    </div>
  );
}
