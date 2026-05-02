import { Progress } from "@/components/ui/progress";

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
): { progress: number; label: string } {
  const { pending, processing, completed, failed, blocked, skipped } =
    pageCounts;
  const total = pending + processing + completed + failed + blocked + skipped;

  if (status === "pending") {
    return { progress: 5, label: "Waiting to start..." };
  }
  if (status === "discovering") {
    return { progress: 15, label: "Discovering pages..." };
  }
  if (status === "crawling" && total > 0) {
    const done = completed + failed + blocked + skipped;
    return {
      progress: 20 + Math.round((done / total) * 80),
      label: `Processing ${done} of ${total} pages...`,
    };
  }
  if (status === "crawling") {
    return { progress: 20, label: "Processing pages..." };
  }
  return { progress: 0, label: "Waiting to start..." };
}

export function CrawlProgress({
  status,
  pageCounts,
}: {
  status: string;
  pageCounts: PageCounts;
}) {
  const { progress, label } = computeCrawlProgress(status, pageCounts);
  return (
    <div className="px-4 pb-3">
      <Progress value={progress} className="h-2" />
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
