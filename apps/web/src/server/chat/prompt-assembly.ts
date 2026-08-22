import type { messages } from "@teachanything/db/schema";
import type { RAGContextResult } from "@/server/rag-context";
import {
  buildStudyResultsNote,
  type StoredStudyResponse,
} from "@/server/study/model-note";
import { buildStudyToolsAddendum, type StudyUIMessage } from "./study-tools";
import { rowToUIMessage, stripToolPartsForTextModel } from "./ui-messages";

type HistoryRow = typeof messages.$inferSelect;

/** Grounding rule ported verbatim from the agentic path in chat.ts. */
function buildGroundingRule(hasInjectedContext: boolean): string {
  return (
    "\n\nYou can search the attached documents using tools." +
    (hasInjectedContext
      ? " The passages above were already retrieved by searching the documents for the user's message; search again only when they are insufficient."
      : "") +
    " You MUST check the retrieved passages or call search_documents before stating whether the documents do or do not contain something. " +
    "If a search returns nothing, say you couldn't find it in the materials rather than denying it exists. " +
    "Do NOT put inline citations, source tags, page numbers, bracketed reference markers, or JSON anchors " +
    '(e.g. "(file.pdf, p. 2)" or "【…】") in your answer text -- the app shows the user the sources ' +
    "separately. Reply in clean prose."
  );
}

/**
 * Assemble a turn's system prompts (primary + static fallback) and the
 * UIMessage list sent to the model.
 */
export function buildTurnPrompts(args: {
  chatbotSystemPrompt: string;
  ragResult: RAGContextResult;
  maxOutputTokens: number;
  modelCanUseTools: boolean;
  useRetrievalTools: boolean;
  trimmedHistory: HistoryRow[];
  userMessage: StudyUIMessage;
  studyResponsesByToolCallId: Map<string, StoredStudyResponse[]>;
}): {
  primarySystemPrompt: string;
  fallbackSystemPrompt: string;
  uiMessages: StudyUIMessage[];
} {
  // System prompts. The primary (agentic) prompt carries the grounding rule +
  // study addendum when retrieval tools are on; otherwise it mirrors the static
  // path (failure note prepended, no grounding rule) plus the study addendum.
  // The fallback is the pure static prompt (no tools, no addendum).
  // History rows -> UIMessages. Built once here so the study-results note can be
  // derived from the full (pre-strip) history.
  const rawHistoryUiMessages = args.trimmedHistory.map(rowToUIMessage);

  // Tell the model how the student did on study tools shown earlier (quiz
  // scores per attempt, or "not yet answered"), since render-only tools return
  // no result to the model. Appended to whichever system prompt is used so it
  // reaches tool-capable and non-tool models alike.
  const studyResultsNote = buildStudyResultsNote(
    rawHistoryUiMessages,
    args.studyResponsesByToolCallId,
  );

  const studyAddendum = args.modelCanUseTools
    ? buildStudyToolsAddendum(args.maxOutputTokens, args.useRetrievalTools)
    : "";
  const primarySystemPrompt =
    (args.useRetrievalTools
      ? args.chatbotSystemPrompt +
        args.ragResult.fileManifest +
        args.ragResult.contextText +
        buildGroundingRule(Boolean(args.ragResult.contextText)) +
        studyAddendum
      : args.ragResult.ragFailureNote +
        args.chatbotSystemPrompt +
        args.ragResult.fileManifest +
        args.ragResult.contextText +
        studyAddendum) + studyResultsNote;
  const fallbackSystemPrompt =
    args.ragResult.ragFailureNote +
    args.chatbotSystemPrompt +
    args.ragResult.fileManifest +
    args.ragResult.contextText +
    studyResultsNote;

  // History -> ModelMessages, then append the new message. A non-tool model
  // (e.g. the bot was switched after a quiz was persisted) must not receive
  // tool-call messages, or the provider can 400 the turn, so down-convert any
  // persisted study-tool parts to text first.
  const historyUiMessages = args.modelCanUseTools
    ? rawHistoryUiMessages
    : rawHistoryUiMessages.map(stripToolPartsForTextModel);
  const uiMessages: StudyUIMessage[] = [...historyUiMessages, args.userMessage];

  return { primarySystemPrompt, fallbackSystemPrompt, uiMessages };
}
