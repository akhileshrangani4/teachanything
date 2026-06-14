"use client";

import { Globe, Plus } from "lucide-react";
import { type RouterOutputs } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getSourceDisplayName } from "@/lib/crawler-metadata";
import { SourceStatusBadge } from "./status-badges";

type AttachableSource =
  RouterOutputs["crawler"]["getAttachableSources"][number];

export function AttachExistingSources({
  sources,
  onAttach,
  attachingId,
  isAttaching,
}: {
  sources: AttachableSource[];
  onAttach: (crawlSourceId: string) => void;
  attachingId: string | null;
  isAttaching: boolean;
}) {
  if (sources.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <Label>Attach an existing web source</Label>
      <div className="divide-y rounded-md border">
        {sources.map((source) => {
          const displayName = getSourceDisplayName(source);
          return (
            <div
              key={source.id}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{displayName}</p>
                {displayName !== source.rootUrl && (
                  <p className="truncate text-xs text-muted-foreground">
                    {source.rootUrl}
                  </p>
                )}
              </div>
              <SourceStatusBadge status={source.status} />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isAttaching}
                onClick={() => onAttach(source.id)}
              >
                <Plus className="mr-1 h-4 w-4" />
                {attachingId === source.id ? "Attaching..." : "Attach"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
