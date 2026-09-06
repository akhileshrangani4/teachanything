// Generic file type that works with both list and listForChatbot responses
export type BaseFile = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  processingStatus: string;
  metadata?: {
    error?: string;
    chunkCount?: number;
    processedAt?: string;
    processingProgress?: {
      stage:
        | "downloading"
        | "extracting"
        | "chunking"
        | "embedding"
        | "storing";
      percentage: number;
      currentChunk?: number;
      totalChunks?: number;
      startedAt?: string;
      lastUpdatedAt?: string;
    };
  };
  createdAt?: Date;
};

export type ActionType = "delete" | "remove" | "add" | "none";

// ── Per-row props shared by desktop and mobile ───────────────────────
export interface FileTableRowProps<T extends BaseFile> {
  file: T;
  showCheckbox?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (fileId: string) => void;
  actionType?: ActionType;
  onAction?: (fileId: string) => void;
  actionDisabled?: boolean;
  onRetry?: (fileId: string) => void;
  retryDisabled?: boolean;
  showCreatedDate?: boolean;
}
