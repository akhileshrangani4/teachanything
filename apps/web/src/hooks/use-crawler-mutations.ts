"use client";

import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { AppRouter } from "@/server/routers/_app";
import type { inferRouterInputs } from "@trpc/server";

type RouterInputs = inferRouterInputs<AppRouter>;

interface MutationFacade<TInput> {
  mutate: (input: TInput) => void;
  mutateAsync: (input: TInput) => Promise<unknown>;
  isPending: boolean;
  variables: TInput | undefined;
}

export interface CrawlerMutations {
  attach: MutationFacade<RouterInputs["crawler"]["attachToChatbot"]>;
  detach: MutationFacade<RouterInputs["crawler"]["detachFromChatbot"]>;
  recrawl: MutationFacade<RouterInputs["crawler"]["recrawl"]>;
  cancelCrawlSource: MutationFacade<
    RouterInputs["crawler"]["cancelCrawlSource"]
  >;
  toggleCrawlSource: MutationFacade<
    RouterInputs["crawler"]["toggleCrawlSource"]
  >;
  renameCrawlSource: MutationFacade<
    RouterInputs["crawler"]["renameCrawlSource"]
  >;
  removeCrawlSource: MutationFacade<
    RouterInputs["crawler"]["removeCrawlSource"]
  >;
}

interface UseCrawlerMutationsOptions {
  /**
   * Refreshes the source list after every successful mutation. Fired without
   * awaiting, matching the original inline wiring.
   */
  refresh: () => void | Promise<unknown>;
  /**
   * Extra refresh for attach/detach (e.g. invalidate the chatbot's
   * attachable-sources list). Not awaited.
   */
  refreshAttachments?: () => void;
  /**
   * Success toasts for attach/detach. Omit both to stay silent after
   * attach/detach.
   */
  attachSuccessMessage?: string;
  detachSuccessMessage?: string;
  /**
   * Extra awaited refresh for rename, replacing `refresh` when provided
   * (e.g. also invalidate the dashboard list). Awaited before the toast.
   */
  refreshAfterRename?: () => Promise<unknown>;
  /** Formats error-toast descriptions. Defaults to the raw error message. */
  formatError?: (error: { message: string }) => string;
}

/**
 * Shared mutation wiring for crawl-source actions (attach/detach, re-crawl,
 * stop, toggle, rename, delete): invalidation + success/error toasts live
 * here so callers only pass refresh callbacks and read `.mutate`/`.isPending`.
 */
export function useCrawlerMutations(
  options: UseCrawlerMutationsOptions,
): CrawlerMutations {
  const {
    refresh,
    refreshAttachments,
    attachSuccessMessage,
    detachSuccessMessage,
    refreshAfterRename,
    formatError = (error) => error.message,
  } = options;

  const showError = (fallback: string, error: { message: string }) =>
    toast.error(fallback, { description: formatError(error) });

  const attach = trpc.crawler.attachToChatbot.useMutation({
    onSuccess: () => {
      void refresh();
      refreshAttachments?.();
      if (attachSuccessMessage) {
        toast.success(attachSuccessMessage);
      }
    },
    onError: (error) => showError("Failed to attach", error),
  });

  const detach = trpc.crawler.detachFromChatbot.useMutation({
    onSuccess: () => {
      void refresh();
      refreshAttachments?.();
      if (detachSuccessMessage) {
        toast.success(detachSuccessMessage);
      }
    },
    onError: (error) => showError("Failed to remove", error),
  });

  const recrawl = trpc.crawler.recrawl.useMutation({
    onSuccess: () => {
      void refresh();
      toast.success("Re-crawl started");
    },
    onError: (error) => showError("Failed to start re-crawl", error),
  });

  const cancelCrawlSource = trpc.crawler.cancelCrawlSource.useMutation({
    onSuccess: () => {
      void refresh();
      toast.success("Crawl stopped");
    },
    onError: (error) => showError("Failed to stop crawl", error),
  });

  const toggleCrawlSource = trpc.crawler.toggleCrawlSource.useMutation({
    onSuccess: (_data, variables) => {
      void refresh();
      toast.success(variables.enabled ? "Source enabled" : "Source disabled");
    },
    onError: (error) => showError("Failed to toggle source", error),
  });

  const renameCrawlSource = trpc.crawler.renameCrawlSource.useMutation({
    onSuccess: async () => {
      if (refreshAfterRename) {
        await refreshAfterRename();
      } else {
        void refresh();
      }
      toast.success("Web source renamed");
    },
    onError: (error) => showError("Failed to rename source", error),
  });

  const removeCrawlSource = trpc.crawler.removeCrawlSource.useMutation({
    onSuccess: () => {
      void refresh();
      toast.success("Web source deleted");
    },
    onError: (error) => showError("Failed to delete source", error),
  });

  return {
    attach: {
      mutate: (input) => attach.mutate(input),
      mutateAsync: (input) => attach.mutateAsync(input),
      isPending: attach.isPending,
      variables: attach.variables,
    },
    detach: {
      mutate: (input) => detach.mutate(input),
      mutateAsync: (input) => detach.mutateAsync(input),
      isPending: detach.isPending,
      variables: detach.variables,
    },
    recrawl: {
      mutate: (input) => recrawl.mutate(input),
      mutateAsync: (input) => recrawl.mutateAsync(input),
      isPending: recrawl.isPending,
      variables: recrawl.variables,
    },
    cancelCrawlSource: {
      mutate: (input) => cancelCrawlSource.mutate(input),
      mutateAsync: (input) => cancelCrawlSource.mutateAsync(input),
      isPending: cancelCrawlSource.isPending,
      variables: cancelCrawlSource.variables,
    },
    toggleCrawlSource: {
      mutate: (input) => toggleCrawlSource.mutate(input),
      mutateAsync: (input) => toggleCrawlSource.mutateAsync(input),
      isPending: toggleCrawlSource.isPending,
      variables: toggleCrawlSource.variables,
    },
    renameCrawlSource: {
      mutate: (input) => renameCrawlSource.mutate(input),
      mutateAsync: (input) => renameCrawlSource.mutateAsync(input),
      isPending: renameCrawlSource.isPending,
      variables: renameCrawlSource.variables,
    },
    removeCrawlSource: {
      mutate: (input) => removeCrawlSource.mutate(input),
      mutateAsync: (input) => removeCrawlSource.mutateAsync(input),
      isPending: removeCrawlSource.isPending,
      variables: removeCrawlSource.variables,
    },
  };
}
