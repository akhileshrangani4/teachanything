import type { TFunction } from "i18next";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";

interface PageCounts {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  blocked: number;
  skipped: number;
}

function computeCrawlProgress(
  status: string,
  pageCounts: PageCounts,
  t: TFunction,
): { progress: number; label: string } {
  const { pending, processing, completed, failed, blocked, skipped } =
    pageCounts;
  const total = pending + processing + completed + failed + blocked + skipped;

  if (status === "pending") {
    return { progress: 5, label: t("webSources.progress.waiting") };
  }
  if (status === "discovering") {
    return { progress: 15, label: t("webSources.progress.discovering") };
  }
  if (status === "crawling" && total > 0) {
    const done = completed + failed + blocked + skipped;
    return {
      progress: 20 + Math.round((done / total) * 80),
      label: t("webSources.progress.processingOf", { done, total }),
    };
  }
  if (status === "crawling") {
    return { progress: 20, label: t("webSources.progress.processing") };
  }
  return { progress: 0, label: t("webSources.progress.waiting") };
}

export function CrawlProgress({
  status,
  pageCounts,
}: {
  status: string;
  pageCounts: PageCounts;
}) {
  const { t } = useTranslation();
  const { progress, label } = computeCrawlProgress(status, pageCounts, t);
  return (
    <div className="px-4 pb-3">
      <Progress value={progress} className="h-2" />
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
