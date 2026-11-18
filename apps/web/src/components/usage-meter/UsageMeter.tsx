import { cn } from "@/lib/utils";
import { usageLevel } from "@/lib/usage-level";

interface UsageMeterProps {
  /** Student messages so far today. */
  used: number;
  /** The daily limit that applies. */
  limit: number;
  /** Accessible description of the meter; defaults to English. */
  label?: string;
  className?: string;
}

const BAR_COLOR = {
  normal: "bg-primary",
  high: "bg-amber-500",
  full: "bg-destructive",
} as const;

/** "87 / 150" with a thin bar that turns amber near the limit, red at it. */
export function UsageMeter({ used, limit, label, className }: UsageMeterProps) {
  const level = usageLevel(used, limit);
  const percent = Math.min(100, Math.round((used / limit) * 100));

  return (
    <div className={cn("flex w-28 flex-col gap-1", className)}>
      <span className="text-sm tabular-nums">
        <span className="font-medium">{used.toLocaleString()}</span>
        <span className="text-muted-foreground">
          {" "}
          / {limit.toLocaleString()}
        </span>
      </span>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        aria-label={label ?? `${used} of ${limit} messages today`}
      >
        <div
          className={cn("h-full rounded-full", BAR_COLOR[level])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
