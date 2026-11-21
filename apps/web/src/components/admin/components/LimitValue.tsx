interface LimitValueProps {
  /** The admin override, or null when the default applies. */
  limit: number | null;
  defaultLimit: number;
}

/** "450 per day · Custom" or "150 per day · Default". */
export function LimitValue({ limit, defaultLimit }: LimitValueProps) {
  return (
    <div className="flex flex-col">
      <span className="text-sm font-medium tabular-nums">
        {(limit ?? defaultLimit).toLocaleString()} per day
      </span>
      <span className="text-xs text-muted-foreground">
        {limit === null ? "Default" : "Custom"}
      </span>
    </div>
  );
}
