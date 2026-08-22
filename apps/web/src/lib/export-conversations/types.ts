import type { ExportStudyTool } from "@/lib/study-tool-export";

export type { ExportStudyTool };

export type ExportFormat = "html" | "csv" | "text";

export interface ExportSource {
  fileName: string;
  similarity: number;
}

export interface ExportMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string | Date;
  sources: ExportSource[];
  // Study-tool widgets shown in this (assistant) turn, with student attempts.
  // Optional so older payloads without study tools stay valid.
  studyTools?: ExportStudyTool[];
}

export interface ExportConversation {
  id: string;
  sessionId: string;
  createdAt: string | Date;
  messages: ExportMessage[];
}

export interface ConversationsExport {
  chatbotName: string;
  exportedAt: string | Date;
  truncated: boolean;
  maxConversations: number;
  conversations: ExportConversation[];
}
