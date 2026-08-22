import { messages, analytics } from "@teachanything/db/schema";
import type { db as DbType } from "@teachanything/db";
import { logError, logInfo } from "@/lib/logger";
import { parseQuizFromText } from "@/lib/quiz";
import { isRetrievalToolPart } from "@/lib/retrieval-tool-names";
import type { RAGContextResult } from "@/server/rag-context";
import type { StudyUIMessage } from "./study-tools";
import {
  assistantMessageForDb,
  hasPersistableStudyPart,
  PARTS_VERSION,
} from "./ui-messages";

type SourceList = RAGContextResult["sources"];

export type UserMessageInsert = {
  promise: Promise<unknown>;
  /** Flipped by the catch handler; the insert itself never rejects. */
  state: { failed: boolean };
};

export function beginUserMessageInsert(
  database: typeof DbType,
  args: {
    conversationId: string;
    content: string;
    chatbotId: string;
    sessionId: string;
  },
): UserMessageInsert {
  // Persist the user message up front; awaited before saving the assistant reply
  // so ordering stays correct. The `.catch` records the failure instead of
  // rethrowing so this promise never becomes a dangling rejection (onFinish may
  // await it seconds later, or never); onFinish checks the flag.
  const state = { failed: false };
  const promise = database
    .insert(messages)
    .values({
      conversationId: args.conversationId,
      role: "user",
      content: args.content,
      metadata: {},
    })
    .catch((err) => {
      state.failed = true;
      logError(err, "Failed to insert user message", {
        chatbotId: args.chatbotId,
        sessionId: args.sessionId,
      });
    });
  return { promise, state };
}

/**
 * Persist the finished assistant turn: the message row (when there is
 * persistable content) and the analytics event (when the turn was not
 * interrupted).
 */
export async function persistTurn(args: {
  responseMessage: StudyUIMessage;
  database: typeof DbType;
  conversationId: string;
  chatbotId: string;
  sessionId: string;
  eventType: "message_sent" | "shared_message_sent";
  messageText: string;
  userMessageInsert: UserMessageInsert;
  timedOut: boolean;
  clientAborted: boolean;
  executeErrored: boolean;
  finalSources: SourceList;
  ragUsedFlag: boolean;
  truncated: boolean;
  responseTime: number;
  startTime: number;
}): Promise<void> {
  // Strip retrieval-tool parts (raw chunk outputs) before persisting: the
  // professor dashboard viewer only needs text + study-tool parts.
  const persistedParts = args.responseMessage.parts.filter(
    (p) => !isRetrievalToolPart(p.type),
  );
  const { content, parts } = assistantMessageForDb({
    ...args.responseMessage,
    parts: persistedParts,
  });
  const hasStudyPart = hasPersistableStudyPart(parts);

  // On a client disconnect, don't persist a partial assistant turn (or its
  // analytics) -- UNLESS it carries quiz content. The rendered quiz stays
  // interactive on screen after a Stop, and recording an attempt requires
  // the persisted part to validate against; skipping the persist would make
  // every submission for that quiz 404 forever. The user message was
  // already saved up front either way.
  //
  // A quiz the model leaked into the text channel (see `recoverLeakedQuiz`)
  // counts as quiz content too, even though it never became a tool part.
  // Buffering that leak is exactly what makes the turn look stalled, so it
  // is the turn a student is most likely to Stop -- and dropping it is what
  // made a quiz turn vanish from the professor's transcript entirely. Only
  // parsed on the abort path: on every other turn the answer is unused, and
  // this is a full scan plus a JSON parse of the whole message.
  if (
    args.clientAborted &&
    !hasStudyPart &&
    parseQuizFromText(content) === null
  )
    return;

  const interrupted =
    args.timedOut || args.executeErrored || args.clientAborted;
  // If `execute` errored before setting responseTime, fall back to elapsed
  // time so we never persist/report a misleading 0.
  const finalResponseTime = args.responseTime || Date.now() - args.startTime;

  try {
    await args.userMessageInsert.promise;
    // Ordering intent: if the user turn failed to persist, don't attach an
    // assistant reply (or analytics) to a missing turn.
    if (args.userMessageInsert.state.failed) return;

    const inserts: PromiseLike<unknown>[] = [];

    // Persist when the model produced text OR a render-only study part
    // (a quiz-only turn has empty content but must be saved). A genuinely
    // empty turn is not persisted, so reloaded history has no blank bubble.
    if (content.trim() || hasStudyPart) {
      inserts.push(
        args.database.insert(messages).values({
          conversationId: args.conversationId,
          role: "assistant",
          content,
          metadata: {
            parts,
            partsVersion: PARTS_VERSION,
            sources: args.finalSources,
            responseTime: finalResponseTime,
            ragUsed: args.ragUsedFlag,
            truncated: args.truncated || undefined,
            interrupted: interrupted || undefined,
          },
        }),
      );
    }

    if (!interrupted) {
      const ragSimilarityScore =
        args.finalSources.length > 0
          ? Math.max(...args.finalSources.map((s) => s.similarity))
          : undefined;
      inserts.push(
        args.database.insert(analytics).values({
          chatbotId: args.chatbotId,
          eventType: args.eventType,
          eventData: {
            sessionId: args.sessionId,
            responseTime: finalResponseTime,
            messageLength: args.messageText.length,
            responseLength: content.length,
            // Use the merged final sources (initial RAG + tool-retrieved) so an
            // agentic turn whose sources came only from tool calls isn't logged
            // as ragUsed:false / sourcesCount:0 alongside a real similarity.
            ragUsed: args.ragUsedFlag,
            ragSimilarityScore,
            sourcesCount: args.finalSources.length,
            question: args.messageText.slice(0, 500),
          },
          sessionId: args.sessionId,
        }),
      );
    }

    await Promise.all(inserts);

    if (!interrupted) {
      logInfo("Chat message processed", {
        chatbotId: args.chatbotId,
        sessionId: args.sessionId,
        responseTime: finalResponseTime,
        eventType: args.eventType,
      });
    }
  } catch (err) {
    logError(err, "Failed to persist assistant message", {
      chatbotId: args.chatbotId,
      sessionId: args.sessionId,
    });
  }
}
