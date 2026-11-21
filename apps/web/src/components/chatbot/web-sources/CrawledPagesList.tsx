"use client";

import { useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EditableName } from "@/components/ui/editable-name";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getPageDisplayTitle } from "@/lib/crawler-metadata";
import { getFriendlyError } from "./utils";
import { PageStatusBadge } from "./StatusBadges";
import { useTranslation } from "react-i18next";

type CrawledPage = RouterOutputs["crawler"]["getCrawledPages"]["pages"][number];

export function CrawledPagesList({
  crawlSourceId,
  isExpanded,
}: {
  crawlSourceId: string;
  isExpanded: boolean;
}) {
  const { t } = useTranslation();
  const [offset, setOffset] = useState(0);
  const limit = 10;
  const utils = trpc.useUtils();
  const pageQueryInput = { crawlSourceId, limit, offset };

  const { data, isLoading } = trpc.crawler.getCrawledPages.useQuery(
    pageQueryInput,
    { enabled: isExpanded, staleTime: 30_000 },
  );

  const removeCrawledPage = trpc.crawler.removeCrawledPage.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.crawler.getCrawledPages.invalidate(pageQueryInput),
        utils.crawler.getCrawlSources.invalidate(),
      ]);
      toast.success(t("webSources.pages.removed"));
    },
    onError: (error) => {
      toast.error(t("webSources.pages.removeFailed"), {
        description: getFriendlyError(error, t),
      });
    },
  });

  const renameCrawledPage = trpc.crawler.renameCrawledPage.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.crawler.getCrawledPages.invalidate(pageQueryInput),
        utils.crawler.getCrawlSources.invalidate(),
        utils.crawler.getAllCrawlSources.invalidate(),
        utils.files.list.invalidate(),
        utils.files.listForChatbot.invalidate(),
      ]);
      toast.success(t("webSources.pages.renamed"));
    },
    onError: (error) => {
      toast.error(t("webSources.pages.renameFailed"), {
        description: getFriendlyError(error, t),
      });
    },
  });

  if (isLoading || !data) {
    return <CrawledPagesSkeleton />;
  }

  if (data.pages.length === 0) {
    return (
      <div className="px-4 pb-4 text-sm text-muted-foreground">
        {t("webSources.pages.empty")}
      </div>
    );
  }

  return (
    <div className="border-t">
      <div className="divide-y">
        {data.pages.map((page) => (
          <CrawledPageRow
            key={page.id}
            page={page}
            isRemoving={removeCrawledPage.isPending}
            isRenaming={renameCrawledPage.isPending}
            onRemove={() =>
              removeCrawledPage.mutate({ crawledPageId: page.id })
            }
            onRename={(title) =>
              renameCrawledPage.mutateAsync({
                crawledPageId: page.id,
                title,
              })
            }
          />
        ))}
      </div>
      {data.totalCount > limit && (
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/50">
          <span className="text-xs text-muted-foreground">
            {t("webSources.pages.range", {
              from: offset + 1,
              to: Math.min(offset + limit, data.totalCount),
              total: data.totalCount,
            })}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              {t("common.actions.previous")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= data.totalCount}
            >
              {t("common.actions.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CrawledPagesSkeleton() {
  return (
    <div className="border-t">
      <div className="divide-y">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="flex items-center justify-between px-4 py-2.5"
          >
            <div className="min-w-0 flex-1 mr-3 space-y-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CrawledPageRow({
  page,
  isRemoving,
  isRenaming,
  onRemove,
  onRename,
}: {
  page: CrawledPage;
  isRemoving: boolean;
  isRenaming: boolean;
  onRemove: () => void;
  onRename: (title: string) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const displayTitle = getPageDisplayTitle(page);
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="min-w-0 flex-1 mr-3">
        <EditableName
          value={displayTitle}
          fallback={page.url}
          ariaLabel={t("webSources.pages.rename")}
          isSaving={isRenaming}
          onSave={onRename}
          className="text-sm"
        />
        <div className="flex items-center gap-2 mt-0.5">
          <a
            href={page.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground truncate flex items-center gap-1"
          >
            {page.url}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
          {typeof page.metadata?.wordCount === "number" && (
            <span className="text-xs text-muted-foreground shrink-0">
              {t("webSources.pages.wordCount", {
                count: page.metadata.wordCount,
              })}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <PageStatusBadge status={page.status} />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={isRemoving}
              title={t("webSources.pages.remove")}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("webSources.pages.remove")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("webSources.pages.removeDescription", {
                  title: displayTitle,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {t("common.actions.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={onRemove}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("common.actions.remove")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
