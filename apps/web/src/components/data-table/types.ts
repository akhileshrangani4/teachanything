/**
 * Shared types for table components
 */

export type FileSortBy =
  "fileName" | "fileType" | "fileSize" | "processingStatus" | "createdAt";

export type WebSourceSortBy =
  "name" | "pageCount" | "status" | "lastCrawledAt" | "createdAt";

export type ChatbotSortBy = "name" | "model" | "createdAt";

/** The admin lists' usage columns: today, last 7 days, last 30 days. */
type UsageSortBy = "usageToday" | "usage7Days" | "usage30Days";

export type UserSortBy =
  "name" | "email" | "role" | "status" | "createdAt" | UsageSortBy;

export type DomainSortBy = "domain" | "createdAt";

export type AdminChatbotSortBy =
  | "name"
  | "owner"
  | "model"
  | "createdAt"
  | "featured"
  | "fileCount"
  | UsageSortBy;

export type PendingUserSortBy = "name" | "email" | "createdAt";
