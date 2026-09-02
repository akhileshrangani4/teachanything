"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/skeletons";

// Loading placeholder matching the all-users table column layout.
export function UsersTableSkeleton() {
  return (
    <TableSkeleton
      minWidth={700}
      header={
        <>
          <Skeleton className="h-4 w-14 shrink-0" />
          <Skeleton className="h-4 w-14 shrink-0" />
          <Skeleton className="h-4 w-10 shrink-0" />
          <Skeleton className="h-4 w-14 shrink-0" />
          <Skeleton className="h-4 w-20 shrink-0" />
          <Skeleton className="h-4 w-14 shrink-0 ml-auto" />
        </>
      }
      row={
        <>
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-32 shrink-0" />
          <Skeleton className="h-5 w-14 rounded-full shrink-0" />
          <Skeleton className="h-5 w-20 rounded-full shrink-0" />
          <Skeleton className="h-4 w-20 shrink-0" />
          <Skeleton className="h-8 w-20 rounded-md shrink-0 ml-auto" />
        </>
      }
    />
  );
}
