"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControls } from "@/components/dashboard/files/PaginationControls";
import { Bot, ExternalLink, Globe, Plus } from "lucide-react";
import { keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { getSourceDisplayName } from "@/lib/crawler-metadata";

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
    trpc.chatbot.list.useQuery({ limit: 1, offset: 0 });

  const sources = data?.sources ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const chatbotCount = chatbotsData?.totalCount ?? 0;
  const hasSources = sources.length > 0;

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              Web Sources
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Find websites and single webpages you have added to your chatbots.
              {data && (
                <span className="ml-2 font-medium text-foreground">
                  ({totalCount} {totalCount === 1 ? "source" : "sources"})
                </span>
              )}
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/dashboard/chatbots">
              <Plus className="h-4 w-4 mr-2" />
              Add From a Chatbot
            </Link>
          </Button>
        </div>

        {isLoading || chatbotsLoading ? (
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
              Web sources live inside chatbots. Open a chatbot, choose Web
              Sources, then add a full website or a single webpage.
            </p>
            <Button asChild className="mt-5">
              <Link href="/dashboard/chatbots">
                {chatbotCount ? "Open Chatbots" : "Create a Chatbot"}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {isFetching && (
              <p className="text-sm text-muted-foreground">
                Updating sources...
              </p>
            )}
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
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Bot className="h-3.5 w-3.5" />
                            {source.chatbotName}
                          </span>
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
                      <Button asChild variant="outline" className="shrink-0">
                        <Link
                          href={`/chatbot/${source.chatbotId}?tab=web-sources`}
                        >
                          Manage Source
                        </Link>
                      </Button>
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
