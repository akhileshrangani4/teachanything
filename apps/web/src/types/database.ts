import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { Quiz } from "@/lib/quiz";
import type { Flashcards } from "@/lib/flashcards";
import type { Test } from "@/lib/test-mode";
import type { MindMap } from "@/lib/mindmap";
import type { Matching } from "@/lib/matching";
import {
  user,
  chatbots,
  fileChunks,
  conversations,
  messages,
  analytics,
  approvedDomains,
} from "@teachanything/db";

// User types
export type User = InferSelectModel<typeof user>;
export type NewUser = InferInsertModel<typeof user>;

// Chatbot types
export type Chatbot = InferSelectModel<typeof chatbots>;
export type NewChatbot = InferInsertModel<typeof chatbots>;

// File chunk types
export type FileChunk = InferSelectModel<typeof fileChunks>;
export type NewFileChunk = InferInsertModel<typeof fileChunks>;

// Conversation types
export type Conversation = InferSelectModel<typeof conversations>;
export type NewConversation = InferInsertModel<typeof conversations>;

// Database message types
export type DBMessage = InferSelectModel<typeof messages>;
export type NewDBMessage = InferInsertModel<typeof messages>;

// Analytics types
export type Analytics = InferSelectModel<typeof analytics>;
export type NewAnalytics = InferInsertModel<typeof analytics>;

// Approved domain types
export type ApprovedDomain = InferSelectModel<typeof approvedDomains>;
export type NewApprovedDomain = InferInsertModel<typeof approvedDomains>;

// ============================================
// Client-side types (for UI/chat components)
// ============================================

/**
 * Structured-mode payload carried on an assistant message. The `messageType`
 * discriminates which interactive widget renders and narrows `structured`.
 * Modes: quiz, flashcards, test, mindmap (see lib/modes/registry.ts).
 */
export type StructuredMessage =
  | { messageType: "quiz"; structured: Quiz }
  | { messageType: "flashcards"; structured: Flashcards }
  | { messageType: "test"; structured: Test }
  | { messageType: "mindmap"; structured: MindMap }
  | { messageType: "matching"; structured: Matching };

// Chat message type (used in frontend chat interfaces)
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    fileName: string;
    chunkIndex: number;
    similarity: number;
  }>;
  cancelled?: boolean;
  truncated?: boolean;
  // Structured Mode: when present, the message renders as an interactive widget
  // (quiz/flashcards/test/mindmap) instead of markdown text. messageType
  // discriminates which; `structured` is its validated payload.
  messageType?: StructuredMessage["messageType"];
  structured?: Quiz | Flashcards | Test | MindMap | Matching;
  // Confirm gate: an ephemeral assistant message that renders a Yes/No card
  // asking whether to generate a study tool. Not persisted server-side -- it
  // exists only for the current turn. `mode` is the structured mode to run on
  // Yes; `topic` seeds the canonical trigger; `originalMessage` is re-sent as
  // normal chat on No.
  confirm?: {
    mode: StructuredMessage["messageType"];
    label: string;
    topic: string;
    originalMessage: string;
  };
}

// Message source type
export interface MessageSource {
  fileName: string;
  chunkIndex: number;
  similarity: number;
}
