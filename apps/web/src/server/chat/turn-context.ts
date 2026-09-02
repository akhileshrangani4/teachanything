import { eq, desc } from "drizzle-orm";
import { messages, studyToolResponses } from "@teachanything/db/schema";
import type { db as DbType } from "@teachanything/db";
import {
  allocateTokenBudget,
  CHARS_PER_TOKEN,
  type OpenRouterClient,
} from "@teachanything/ai";
import { buildRAGContext, type RAGContextResult } from "@/server/rag-context";
import { logWarn } from "@/lib/logger";

export type HistoryRow = typeof messages.$inferSelect;

/** One stored study-tool response row, as selected for the model results note. */
export type StudyResponseRow = {
  toolCallId: string;
  toolName: string;
  response: unknown;
};

export type TurnContext = {
  historyRows: HistoryRow[];
  ragResult: RAGContextResult;
  studyResponseRows: StudyResponseRow[];
};

/**
 * Fetch everything a turn needs up front: message history, RAG context, and
 * prior study-tool responses.
 */
export async function fetchTurnContext(args: {
  database: typeof DbType;
  chatbotId: string;
  conversationId: string;
  messageText: string;
  chunkLimit: number;
  openrouterApiKey: string;
  openaiApiKey: string;
  aiClient: OpenRouterClient;
}): Promise<TurnContext> {
  // History + RAG + prior study-tool responses in parallel (bounded by the
  // slowest of the three).
  const [historyRows, ragResult, studyResponseRows] = await Promise.all([
    args.database
      .select()
      .from(messages)
      .where(eq(messages.conversationId, args.conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(50),
    buildRAGContext({
      chatbotId: args.chatbotId,
      message: args.messageText,
      db: args.database,
      openrouterApiKey: args.openrouterApiKey,
      openaiApiKey: args.openaiApiKey,
      chunkLimit: args.chunkLimit,
      aiClient: args.aiClient,
    }),
    // Student responses to study tools shown earlier, so the model can be told
    // scores / unfinished quizzes. Small per conversation; ordered oldest-first
    // so attempts number naturally.
    args.database
      .select({
        toolCallId: studyToolResponses.toolCallId,
        toolName: studyToolResponses.toolName,
        response: studyToolResponses.response,
      })
      .from(studyToolResponses)
      .where(eq(studyToolResponses.conversationId, args.conversationId))
      .orderBy(studyToolResponses.createdAt)
      // Bounded so the results note can't balloon the prompt on a pathological
      // conversation; far above any realistic count of quiz attempts.
      .limit(200),
  ]);
  return { historyRows, ragResult, studyResponseRows };
}

/** Group study responses by toolCallId for the model results note. */
export function groupStudyResponsesByToolCallId(
  rows: StudyResponseRow[],
): Map<string, Array<{ toolName: string; response: unknown }>> {
  const grouped = new Map<
    string,
    Array<{ toolName: string; response: unknown }>
  >();
  for (const row of rows) {
    const list = grouped.get(row.toolCallId) ?? [];
    list.push({ toolName: row.toolName, response: row.response });
    grouped.set(row.toolCallId, list);
  }
  return grouped;
}

/**
 * Allocate the turn's token budget with real token counts and slice the
 * history down to what fits.
 */
export function computeTrimmedHistory(args: {
  countTokens: (text: string) => number;
  contextWindow: number;
  maxOutputTokens: number;
  systemPromptTokens: number;
  userMessageTokens: number;
  ragResult: Pick<
    RAGContextResult,
    "fileManifest" | "contextText" | "ragFailureNote"
  >;
  historyRows: HistoryRow[];
  chatbotId: string;
  modelId: string;
}): HistoryRow[] {
  // Pass 2: allocate budget with real token counts.
  const fileManifestTokens = args.countTokens(args.ragResult.fileManifest);
  const ragContextTokens = args.countTokens(args.ragResult.contextText);
  const ragFailureNoteTokens = args.countTokens(args.ragResult.ragFailureNote);
  const budget = allocateTokenBudget({
    contextWindow: args.contextWindow,
    maxOutputTokens: args.maxOutputTokens,
    systemPromptTokens: args.systemPromptTokens + ragFailureNoteTokens,
    fileManifestTokens: fileManifestTokens + ragContextTokens,
    userMessageTokens: args.userMessageTokens,
    availableChunks: [],
    availableHistory: args.historyRows.map((m) => ({
      tokens: Math.ceil(m.content.length / CHARS_PER_TOKEN),
    })),
  });
  for (const warning of budget.warnings) {
    logWarn(warning, { chatbotId: args.chatbotId, modelId: args.modelId });
  }
  return budget.historyLimit > 0
    ? args.historyRows.slice(args.historyRows.length - budget.historyLimit)
    : [];
}
