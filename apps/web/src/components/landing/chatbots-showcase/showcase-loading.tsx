"use client";

import { getGridClassName } from "./constants";

// Loading skeletons for the featured chatbots showcase.
export function ShowcaseLoading({
  isSingle,
  chatbotCount,
}: {
  isSingle: boolean;
  chatbotCount: number;
}) {
  if (isSingle) {
    return (
      <div className="grid md:grid-cols-2 gap-20 items-center">
        <div className="aspect-[4/3] bg-muted rounded-2xl animate-pulse" />
        <div className="space-y-4">
          <div className="h-12 bg-muted rounded animate-pulse" />
          <div className="h-6 bg-muted rounded animate-pulse w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-12">
        <div className="h-12 bg-muted rounded animate-pulse mb-4 w-1/3" />
        <div className="h-6 bg-muted rounded animate-pulse w-1/2" />
      </div>
      <div className={getGridClassName(chatbotCount)}>
        {[1, 2, 3, 4].slice(0, chatbotCount || 4).map((i) => (
          <div
            key={i}
            className="aspect-[4/3] bg-muted rounded-2xl animate-pulse"
          />
        ))}
      </div>
    </>
  );
}
