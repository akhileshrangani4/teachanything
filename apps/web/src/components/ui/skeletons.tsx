"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Full dashboard shell skeleton — header bar, sidebar, content area.
 * Used by layout files while the session is loading.
 */
export function DashboardShellSkeleton() {
  return (
    <div className="h-dvh bg-background flex flex-col overflow-hidden">
      <div className="h-14 border-b border-border bg-card px-4 flex items-center gap-4">
        <Skeleton className="h-8 w-32" />
        <div className="ml-auto flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="hidden lg:block w-64 border-r border-border bg-card p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
        <div className="flex-1 p-6 space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-5 w-72" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/**
 * Horizontally-scrollable table skeleton.
 * Renders a header row + N body rows inside an overflow wrapper.
 *
 * @param header  - Cell elements for the header row
 * @param row     - Cell elements repeated for each body row
 * @param rows    - Number of body rows (default 5)
 * @param minWidth - Minimum table width in px for horizontal scroll (default 600)
 */
export function TableSkeleton({
  header,
  row,
  rows = 5,
  minWidth = 600,
}: {
  header: React.ReactNode;
  row: React.ReactNode;
  rows?: number;
  minWidth?: number;
}) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <div style={{ minWidth }} className="divide-y divide-border">
        <div className="flex items-center gap-4 px-4 py-3 bg-muted/50">
          {header}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            {row}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Responsive file-table skeleton — desktop table rows + mobile cards.
 * Matches the FileTable component's dual-layout pattern.
 *
 * @param desktopRows - Number of desktop table rows (default 5)
 * @param mobileCards - Number of mobile cards (default 4)
 */
export function FileTableSkeleton({
  desktopRows = 5,
  mobileCards = 4,
}: {
  desktopRows?: number;
  mobileCards?: number;
}) {
  return (
    <div>
      {/* Desktop table skeleton */}
      <div className="hidden md:block space-y-3">
        <div className="flex items-center gap-4 pb-3 border-b border-border">
          <Skeleton className="h-4 w-24 shrink-0" />
          <Skeleton className="h-4 w-12 shrink-0" />
          <Skeleton className="h-4 w-12 shrink-0" />
          <Skeleton className="h-4 w-14 shrink-0" />
          <Skeleton className="h-4 w-16 shrink-0 ml-auto" />
        </div>
        {Array.from({ length: desktopRows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 py-3 border-b border-border/50 last:border-0"
          >
            <Skeleton className="h-4 w-44 shrink-0" />
            <Skeleton className="h-4 w-16 shrink-0" />
            <Skeleton className="h-4 w-14 shrink-0" />
            <Skeleton className="h-5 w-20 rounded-full shrink-0" />
            <Skeleton className="h-8 w-20 rounded-md shrink-0 ml-auto" />
          </div>
        ))}
      </div>
      {/* Mobile card skeleton */}
      <div className="md:hidden space-y-3">
        {Array.from({ length: mobileCards }).map((_, i) => (
          <div
            key={i}
            className="border border-border/60 rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-4 w-full max-w-[180px]" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Shared chat page skeleton — matches the /chat/[shareToken] page layout:
 * centered card on desktop with header, chat area, and input.
 * Used while the chatbot data loads.
 */
export function SharedChatSkeleton() {
  return (
    <div className="h-dvh w-full overflow-hidden bg-secondary flex justify-center">
      <div className="h-full w-full max-w-6xl flex flex-col bg-background md:my-6 md:rounded-xl md:h-[calc(100dvh-48px)] md:border md:shadow-lg">
        {/* Header */}
        <div className="flex items-center gap-2 px-2 md:px-4 py-2 md:py-2.5 border-b bg-muted/30 flex-shrink-0">
          <Skeleton className="h-3 w-32" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md hidden md:block" />
          </div>
        </div>
        {/* Messages area */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto p-2 md:p-3">
            <div className="space-y-3 md:space-y-4">
              <div className="flex justify-start">
                <Skeleton className="h-16 w-3/4 max-w-sm rounded-lg" />
              </div>
            </div>
          </div>
        </div>
        {/* Input area */}
        <div className="flex-shrink-0 border-t p-2 md:p-4">
          <Skeleton className="h-[60px] md:h-[120px] w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

/**
 * Centered auth-card skeleton — matches the login / register / reset-password forms.
 *
 * @param fields     - Number of form field placeholders (default 2)
 * @param titleWidth - Tailwind width class for the title skeleton (default "w-24")
 * @param descWidth  - Tailwind width class for the description skeleton (default "w-56")
 * @param className  - Extra classes on the centering wrapper
 */
export function AuthCardSkeleton({
  fields = 2,
  titleWidth = "w-24",
  descWidth = "w-56",
  className = "",
}: {
  fields?: number;
  titleWidth?: string;
  descWidth?: string;
  className?: string;
}) {
  return (
    <div
      className={`min-h-screen flex items-center justify-center bg-secondary ${className}`}
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <Skeleton className={`h-7 ${titleWidth}`} />
          <Skeleton className={`h-4 ${descWidth} mt-2`} />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: fields }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
          <Skeleton className="h-10 w-full rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}
