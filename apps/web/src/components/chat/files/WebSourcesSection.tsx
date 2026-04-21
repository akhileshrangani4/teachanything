"use client";

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  Globe,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Ban,
  SkipForward,
} from "lucide-react";
import Link from "next/link";

interface WebSourcesSectionProps {
  chatbotId: string;
}

function getSourceStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case "crawling":
    case "discovering":
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-600">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          {status === "crawling" ? "Crawling" : "Discovering"}
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="text-red-600 border-red-600">
          <AlertCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getPageStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="outline" className="text-green-600 border-green-600">
          Done
        </Badge>
      );
    case "processing":
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-600">
          Processing
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="text-red-600 border-red-600">
          Failed
        </Badge>
      );
    case "blocked":
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
          <Ban className="h-3 w-3 mr-1" />
          Blocked
        </Badge>
      );
    case "skipped":
      return (
        <Badge variant="outline" className="text-gray-500 border-gray-500">
          <SkipForward className="h-3 w-3 mr-1" />
          Unchanged
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function hasActiveCrawl(sources: Array<{ status: string }>): boolean {
  return sources.some(
    (s) =>
      s.status === "pending" ||
      s.status === "discovering" ||
      s.status === "crawling",
  );
}

export function WebSourcesSection({ chatbotId }: WebSourcesSectionProps) {
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    new Set(),
  );

  const { data: sources } = trpc.crawler.getCrawlSources.useQuery(
    { chatbotId },
    {
      refetchInterval: (query) =>
        hasActiveCrawl(query.state.data ?? []) ? 3000 : false,
    },
  );

  if (!sources || sources.length === 0) return null;

  const toggleExpanded = (sourceId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Web Sources
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pages crawled from websites and added to this chatbot&apos;s
            knowledge.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/chatbot/${chatbotId}?tab=web-sources`}>Manage</Link>
        </Button>
      </div>
      <div className="space-y-2">
        {sources.map((source) => (
          <WebSourceRow
            key={source.id}
            source={source}
            isExpanded={expandedSources.has(source.id)}
            onToggle={() => toggleExpanded(source.id)}
          />
        ))}
      </div>
    </div>
  );
}

function WebSourceRow({
  source,
  isExpanded,
  onToggle,
}: {
  source: {
    id: string;
    rootUrl: string;
    status: string;
    pageCounts: {
      pending: number;
      processing: number;
      completed: number;
      failed: number;
      blocked: number;
      skipped: number;
    };
  };
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { pending, processing, completed, failed, blocked, skipped } =
    source.pageCounts;
  const totalPages =
    pending + processing + completed + failed + blocked + skipped;

  return (
    <div className="rounded-lg border">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-3 w-full p-3 text-left hover:bg-muted/50 transition-colors">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{source.rootUrl}</p>
              <div className="flex items-center gap-2 mt-1">
                {getSourceStatusBadge(source.status)}
                <span className="text-xs text-muted-foreground">
                  {totalPages} page{totalPages !== 1 ? "s" : ""}
                  {completed > 0 && ` · ${completed} indexed`}
                </span>
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CrawledPagesList crawlSourceId={source.id} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function CrawledPagesList({ crawlSourceId }: { crawlSourceId: string }) {
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data } = trpc.crawler.getCrawledPages.useQuery({
    crawlSourceId,
    limit,
    offset,
  });

  if (!data || data.pages.length === 0) {
    return (
      <div className="px-4 pb-4 text-sm text-muted-foreground">
        No pages yet.
      </div>
    );
  }

  return (
    <div className="border-t">
      <div className="divide-y">
        {data.pages.map(
          (page: {
            id: string;
            title: string | null;
            url: string;
            status: string;
          }) => (
            <div
              key={page.id}
              className="flex items-center justify-between px-4 py-2"
            >
              <div className="min-w-0 flex-1 mr-3">
                <p className="text-sm truncate">{page.title || page.url}</p>
                <a
                  href={page.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground truncate flex items-center gap-1"
                >
                  {page.url}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
              {getPageStatusBadge(page.status)}
            </div>
          ),
        )}
      </div>
      {data.totalCount > limit && (
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/50">
          <span className="text-xs text-muted-foreground">
            Showing {offset + 1}-{Math.min(offset + limit, data.totalCount)} of{" "}
            {data.totalCount}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= data.totalCount}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
