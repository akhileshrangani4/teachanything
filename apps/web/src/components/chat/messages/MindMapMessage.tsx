"use client";

import { useState } from "react";
import type { MindMap, MindMapNode } from "@/lib/mindmap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Network, ChevronDown, ChevronRight, Dot } from "lucide-react";

interface MindMapMessageProps {
  mindMap: MindMap;
}

// Top this many levels open by default; deeper branches collapse to keep
// large maps tidy on first render.
const DEFAULT_OPEN_DEPTH = 2;
// Defensive cap so pathological model output can't blow the stack/DOM.
const MAX_DEPTH = 6;

function MindMapNodeView({
  node,
  depth,
}: {
  node: MindMapNode;
  depth: number;
}) {
  const hasChildren = !!node.children?.length;
  const [isExpanded, setIsExpanded] = useState(depth < DEFAULT_OPEN_DEPTH);

  // Stop recursing past the cap; surface that the branch was truncated.
  if (depth > MAX_DEPTH) {
    return (
      <div role="treeitem" className="flex items-center gap-1.5 py-1">
        <Dot
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="text-sm text-muted-foreground">{node.label} …</span>
      </div>
    );
  }

  return (
    <div role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined}>
      <div className="flex items-center gap-1.5 py-1">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setIsExpanded((open) => !open)}
            aria-expanded={isExpanded}
            aria-label={`Toggle ${node.label}`}
            className="flex shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        ) : (
          <Dot
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <span
          className={cn(
            "text-sm",
            depth === 0 ? "font-medium md:text-base" : "text-foreground",
          )}
        >
          {node.label}
        </span>
      </div>

      {hasChildren && isExpanded && (
        <div role="group" className="ml-2 border-l border-border/60 pl-3">
          {node.children?.map((child, index) => (
            <MindMapNodeView
              key={`${child.label}-${index}`}
              node={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MindMapMessage({ mindMap }: MindMapMessageProps) {
  return (
    <Card className="bg-secondary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Network className="h-4 w-4 text-primary" aria-hidden="true" />
          {mindMap.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div role="tree" aria-label={mindMap.title}>
          <MindMapNodeView node={mindMap.root} depth={0} />
        </div>
      </CardContent>
    </Card>
  );
}
