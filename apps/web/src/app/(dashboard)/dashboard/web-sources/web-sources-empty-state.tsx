"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

/** Empty state shown when no web sources exist and nothing is filtered. */
export function WebSourcesEmptyState({
  hasChatbots,
}: {
  hasChatbots: boolean;
}) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
      <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p className="text-lg font-medium text-foreground">No web sources yet</p>
      <p className="text-sm mt-1 max-w-xl mx-auto">
        Use <span className="font-medium text-foreground">Add single page</span>{" "}
        or{" "}
        <span className="font-medium text-foreground">Add Full Web Source</span>{" "}
        above to get started.
        {!hasChatbots &&
          " You can create a chatbot later and attach sources to it."}
      </p>
      {!hasChatbots && (
        <Button asChild variant="outline" className="mt-5">
          <Link href="/dashboard/chatbots">Create a Chatbot</Link>
        </Button>
      )}
    </div>
  );
}
