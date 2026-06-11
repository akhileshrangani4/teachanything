"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControls } from "@/components/dashboard/files/PaginationControls";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Bot, ExternalLink, Globe, Loader2 } from "lucide-react";
import { keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getSourceDisplayName } from "@/lib/crawler-metadata";
import { AddWebSourcePanel } from "@/components/dashboard/web-sources/AddWebSourcePanel";

const ITEMS_PER_PAGE = 20;

function getStatusVariant(status: string, enabled: boolean) {
  if (!enabled) return "secondary" as const;
  if (status === "failed") return "destructive" as const;
  return "outline" as const;
}

export default function WebSourcesPage() {
  const [page, setPage] = useState(0);
  const offset = page * ITEMS_PER_PAGE;
  const { data, isLoading, isFetching } =
    trpc.crawler.getAllCrawlSources.useQuery(
      { limit: ITEMS_PER_PAGE, offset },
      { placeholderData: keepPreviousData },
    );
  const { data: chatbotsData, isLoading: chatbotsLoading } =
    trpc.chatbot.list.useQuery({ limit: 100, offset: 0 });

  const sources = data?.sources ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const chatbots = chatbotsData?.chatbots ?? [];
  const chatbotCount = chatbotsData?.totalCount ?? 0;

  const utils = trpc.useUtils();
  const attach = trpc.crawler.attachToChatbot.useMutation({
    onSuccess: () => utils.crawler.getAllCrawlSources.invalidate(),
    onError: (e) => toast.error("Failed to attach", { description: e.message }),
  });
  const detach = trpc.crawler.detachFromChatbot.useMutation({
    onSuccess: () => utils.crawler.getAllCrawlSources.invalidate(),
    onError: (e) => toast.error("Failed to remove", { description: e.message }),
  });
  const hasChatbots = chatbotCount > 0;
  const hasSources = sources.length > 0;
  // Full skeleton only on initial load (no data yet); keep the list and show
  // an inline spinner on background refetch / pagination (keepPreviousData).
  const showFullLoading =
    (isLoading && !data) || (chatbotsLoading && !chatbotsData);
  const showInlineLoading = isFetching && !isLoading;

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              Web Sources
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Crawl full websites or add single webpages, then attach them to
              your chatbots.
              {data && (
                <span className="ml-2 font-medium text-foreground">
                  ({totalCount} {totalCount === 1 ? "source" : "sources"})
                </span>
              )}
              {showInlineLoading && (
                <Loader2 className="ml-2 inline h-4 w-4 animate-spin align-[-2px] text-muted-foreground" />
              )}
            </p>
          </div>
        </div>

        {hasChatbots && !chatbotsLoading && (
          <AddWebSourcePanel chatbots={chatbots} />
        )}

        {showFullLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-lg border border-border/60 p-5 space-y-3"
              >
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-8 w-40" />
              </div>
            ))}
          </div>
        ) : !hasSources ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium text-foreground">
              No web sources yet
            </p>
            <p className="text-sm mt-1 max-w-xl mx-auto">
              {hasChatbots
                ? "Use the form above to crawl a full website or add a single webpage."
                : "Create a chatbot first, then come back here to add full websites or single webpages."}
            </p>
            {!hasChatbots && (
              <Button asChild className="mt-5">
                <Link href="/dashboard/chatbots">Create a Chatbot</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4">
              {sources.map((source) => (
                <Card
                  key={source.id}
                  className="border border-border/60 bg-card shadow-xs"
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex shrink-0 items-center justify-center">
                            <Globe className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <h2 className="truncate text-lg font-semibold">
                              {getSourceDisplayName(source)}
                            </h2>
                            <a
                              href={source.rootUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                            >
                              <span className="truncate">{source.rootUrl}</span>
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            </a>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pl-0 sm:pl-[52px]">
                          <Badge
                            variant={getStatusVariant(
                              source.status,
                              source.enabled,
                            )}
                          >
                            {source.enabled ? source.status : "disabled"}
                          </Badge>
                          <Badge variant="secondary">
                            {source.pageCount}{" "}
                            {source.pageCount === 1 ? "page" : "pages"}
                          </Badge>
                          {source.chatbots.length === 0 ? (
                            <Badge variant="outline">Not attached</Badge>
                          ) : (
                            source.chatbots.map((c) => (
                              <Badge
                                key={c.id}
                                variant="secondary"
                                className="gap-1"
                              >
                                <Bot className="h-3 w-3" />
                                {c.name}
                              </Badge>
                            ))
                          )}
                          {source.lastCrawledAt && (
                            <span className="text-xs text-muted-foreground">
                              Last crawled{" "}
                              {new Date(
                                source.lastCrawledAt,
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="shrink-0">
                            <Bot className="mr-2 h-4 w-4" />
                            Chatbots
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>
                            Attach to chatbots
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {chatbots.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              No chatbots yet. Create one to attach this source.
                            </div>
                          ) : (
                            chatbots.map((chatbot) => {
                              const attached = source.chatbots.some(
                                (c) => c.id === chatbot.id,
                              );
                              return (
                                <DropdownMenuCheckboxItem
                                  key={chatbot.id}
                                  checked={attached}
                                  disabled={
                                    attach.isPending || detach.isPending
                                  }
                                  onSelect={(e) => e.preventDefault()}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      attach.mutate({
                                        crawlSourceId: source.id,
                                        chatbotId: chatbot.id,
                                      });
                                    } else {
                                      detach.mutate({
                                        crawlSourceId: source.id,
                                        chatbotId: chatbot.id,
                                      });
                                    }
                                  }}
                                >
                                  <span className="truncate">
                                    {chatbot.name}
                                  </span>
                                </DropdownMenuCheckboxItem>
                              );
                            })
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {totalPages > 1 && (
              <PaginationControls
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
