"use client";

import type { ReactNode } from "react";

const SELECT_ALL_CHECKBOX_CLASS =
  "h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer";

interface ResponsiveTableShellProps {
  /**
   * Renders the mobile "Select all" row when provided. The desktop select-all
   * column is part of the table itself.
   */
  selectAll?: {
    checked: boolean;
    onChange: () => void;
    ariaLabel: string;
  };
  /** Desktop render (the <Table> tree), shown at md and up. */
  desktop: ReactNode;
  /** Mobile card list, stacked below md. */
  mobile: ReactNode;
}

/**
 * Dual-render wrapper for lists that show a desktop table plus stacked
 * mobile cards: `hidden md:block` around the desktop tree, `md:hidden
 * space-y-3` with an optional "Select all" row around the mobile list.
 */
export function ResponsiveTableShell({
  selectAll,
  desktop,
  mobile,
}: ResponsiveTableShellProps) {
  return (
    <>
      {/* Desktop table view */}
      <div className="hidden md:block">{desktop}</div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {selectAll && (
          <div className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              checked={selectAll.checked}
              onChange={selectAll.onChange}
              className={SELECT_ALL_CHECKBOX_CLASS}
              aria-label={selectAll.ariaLabel}
            />
            <span className="text-sm text-muted-foreground">Select all</span>
          </div>
        )}
        {mobile}
      </div>
    </>
  );
}
