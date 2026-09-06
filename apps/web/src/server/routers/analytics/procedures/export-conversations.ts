import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import {
  conversations,
  messages,
  studyToolResponses,
} from "@teachanything/db/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  collectStudyTools,
  groupStudyResponses,
  type CollectedStudyTool,
} from "@/server/study/collect-export";
import { assertOwnedChatbot } from "@/server/queries/chatbot";
import { checkRateLimit, downloadRateLimit } from "@/server/rate-limit";

/**
 * Export student chat records for a chatbot the caller owns. Returns the
 * full transcripts (user + assistant turns, timestamps, RAG sources) for the
 * given conversations, or for ALL of the chatbot's conversations when no ids
 * are passed. Powers the "Export" action in the Student Chats tab; the client
 * turns this payload into the chosen HTML/CSV/text files.
 *
 * This pages through unindexed content, so it is rate-limited and capped at
 * EXPORT_MAX_CONVERSATIONS per request (with a `truncated` flag so the client
 * can warn the professor when a chatbot has more than one bundle's worth).
 */
export const exportConversationsProcedure = protectedProcedure
  .input(
    z.object({
      chatbotId: z.string().uuid(),
      // Omitted or empty => export every conversation for the chatbot.
      conversationIds: z.array(z.string().uuid()).max(1000).optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const chatbot = await assertOwnedChatbot(ctx, input.chatbotId);

    const { success } = await checkRateLimit(
      downloadRateLimit,
      ctx.session.user.id,
      { path: "analytics.exportConversations" },
    );
    if (!success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many exports. Please wait a moment and try again.",
      });
    }

    const EXPORT_MAX_CONVERSATIONS = 1000;
    const selecting =
      input.conversationIds !== undefined && input.conversationIds.length > 0;

    // Resolve which conversations to export, always scoped to this chatbot so
    // a caller can't reach another chatbot's records by id. Fetch one extra
    // row to detect (and flag) truncation.
    const conversationRows = await ctx.db
      .select({
        id: conversations.id,
        sessionId: conversations.sessionId,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.chatbotId, input.chatbotId),
          selecting
            ? inArray(conversations.id, input.conversationIds!)
            : undefined,
        ),
      )
      .orderBy(asc(conversations.createdAt), asc(conversations.id))
      .limit(EXPORT_MAX_CONVERSATIONS + 1);

    const truncated = conversationRows.length > EXPORT_MAX_CONVERSATIONS;
    const selectedConversations = truncated
      ? conversationRows.slice(0, EXPORT_MAX_CONVERSATIONS)
      : conversationRows;

    const exportedAt = new Date().toISOString();

    if (selectedConversations.length === 0) {
      return {
        chatbotName: chatbot.name,
        exportedAt,
        truncated: false,
        maxConversations: EXPORT_MAX_CONVERSATIONS,
        conversations: [],
      };
    }

    const conversationIds = selectedConversations.map((c) => c.id);

    // Pull all visible turns for the selected conversations in one query,
    // globally ordered so each conversation's turns land in chronological
    // order when grouped below. System/internal messages are excluded to
    // mirror what the professor sees in the conversation viewer.
    const messageRows = await ctx.db
      .select({
        conversationId: messages.conversationId,
        role: messages.role,
        content: messages.content,
        metadata: messages.metadata,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(
        and(
          inArray(messages.conversationId, conversationIds),
          inArray(messages.role, ["user", "assistant"]),
        ),
      )
      .orderBy(asc(messages.createdAt), asc(messages.id));

    // Student study-tool attempts (quiz answers) for the selected
    // conversations, matched to the quiz that was shown via `toolCallId`.
    // Ordered chronologically so attempts label as 1, 2, ... per quiz.
    const responseRows = await ctx.db
      .select({
        conversationId: studyToolResponses.conversationId,
        toolCallId: studyToolResponses.toolCallId,
        attempt: studyToolResponses.attempt,
        response: studyToolResponses.response,
      })
      .from(studyToolResponses)
      .where(inArray(studyToolResponses.conversationId, conversationIds))
      .orderBy(asc(studyToolResponses.createdAt))
      .limit(20000);

    // Group attempts by (conversation, toolCallId); `response` stays raw so
    // the client renderer for each tool interprets its own payload shape.
    const responsesByKey = groupStudyResponses(responseRows);

    const messagesByConversation = new Map<
      string,
      Array<{
        role: "user" | "assistant";
        content: string;
        createdAt: Date;
        sources: Array<{ fileName: string; similarity: number }>;
        studyTools: CollectedStudyTool[];
      }>
    >();

    for (const row of messageRows) {
      const list = messagesByConversation.get(row.conversationId) ?? [];
      list.push({
        role: row.role as "user" | "assistant",
        content: row.content,
        createdAt: row.createdAt,
        sources: (row.metadata?.sources ?? []).map((s) => ({
          fileName: s.fileName,
          similarity: s.similarity,
        })),
        studyTools:
          row.role === "assistant"
            ? collectStudyTools(
                row.metadata?.parts,
                row.conversationId,
                responsesByKey,
              )
            : [],
      });
      messagesByConversation.set(row.conversationId, list);
    }

    return {
      chatbotName: chatbot.name,
      exportedAt,
      truncated,
      maxConversations: EXPORT_MAX_CONVERSATIONS,
      conversations: selectedConversations.map((c) => ({
        id: c.id,
        sessionId: c.sessionId,
        createdAt: c.createdAt,
        messages: messagesByConversation.get(c.id) ?? [],
      })),
    };
  });
