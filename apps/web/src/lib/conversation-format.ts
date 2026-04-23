/**
 * Pure formatting helpers for the Conversations UI. Extracted from the
 * component so unit tests can import them without loading the full React
 * tree (Streamdown/shiki are ESM and Jest cannot parse them directly).
 */

export function formatDuration(
  firstAt: Date | null,
  lastAt: Date | null,
): string {
  if (!firstAt || !lastAt) return "-";
  const ms = Math.max(
    0,
    new Date(lastAt).getTime() - new Date(firstAt).getTime(),
  );
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  const hours = Math.floor(ms / 3600000);
  const mins = Math.round((ms % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

export function formatTimestamp(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}
