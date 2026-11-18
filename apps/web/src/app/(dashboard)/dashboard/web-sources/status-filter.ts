export type StatusFilter =
  "all" | "crawling" | "completed" | "failed" | "disabled";

export const STATUS_OPTIONS: StatusFilter[] = [
  "all",
  "crawling",
  "completed",
  "failed",
  "disabled",
];
