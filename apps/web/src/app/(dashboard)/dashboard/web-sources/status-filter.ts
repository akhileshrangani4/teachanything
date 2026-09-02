export type StatusFilter =
  | "all"
  | "crawling"
  | "completed"
  | "failed"
  | "disabled";

export const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "crawling", label: "Crawling" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "disabled", label: "Disabled" },
];
