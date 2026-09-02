"use client";

import { Skeleton } from "@/components/ui/skeleton";

/** Full-page loading skeleton for the chatbot detail view. */
export function ChatbotLoadingSkeleton() {
  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 min-w-0">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <Skeleton className="h-10 w-64 mb-3" />
          <Skeleton className="h-5 w-96" />
          <div className="flex items-center gap-2 mt-4">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-16 rounded-md" />
          <Skeleton className="h-9 w-16 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    </div>
  );
}
