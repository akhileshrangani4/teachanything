/**
 * Shared types for table components
 */

export type FileSortBy =
  | "fileName"
  | "fileType"
  | "fileSize"
  | "processingStatus"
  | "createdAt";

export type WebSourceSortBy =
  | "name"
  | "pageCount"
  | "status"
  | "lastCrawledAt"
  | "createdAt";

export type ChatbotSortBy = "name" | "model" | "createdAt";

export type UserSortBy = "name" | "email" | "role" | "status" | "createdAt";

export type DomainSortBy = "domain" | "createdAt";

export type AdminChatbotSortBy =
  | "name"
  | "owner"
  | "model"
  | "createdAt"
  | "featured"
  | "fileCount";

export type PendingUserSortBy = "name" | "email" | "createdAt";
