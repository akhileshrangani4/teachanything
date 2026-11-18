import type { RouterOutputs } from "@/lib/trpc";
import { UsageMeter } from "./UsageMeter";

type MessageUsage =
  RouterOutputs["admin"]["getAllChatbots"]["chatbots"][number]["usage"];

interface UsageSummaryProps {
  usage: MessageUsage;
  /** The daily limit that applies today. */
  limit: number;
}

/** Today against the daily limit, plus 7-day and 30-day totals. */
export function UsageSummary({ usage, limit }: UsageSummaryProps) {
  return (
    <div className="grid grid-cols-3 gap-3 rounded-lg border p-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Today</span>
        <UsageMeter used={usage.today} limit={limit} className="w-full" />
      </div>
      <Stat label="Last 7 days" value={usage.last7Days} />
      <Stat label="Last 30 days" value={usage.last30Days} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">
        {value.toLocaleString()}
      </span>
    </div>
  );
}
