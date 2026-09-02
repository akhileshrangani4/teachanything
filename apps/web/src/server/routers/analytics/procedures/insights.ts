import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { messages, conversations, analytics } from "@teachanything/db/schema";
import { eq, and, sql, desc, asc, inArray } from "drizzle-orm";
import { formatPreview } from "@/server/utils";
import { assertOwnedChatbot } from "@/server/queries/chatbot";
import { MESSAGE_EVENT_TYPES, analyticsSessionId } from "../helpers";

export const getCommonQuestionsProcedure = protectedProcedure
  .input(
    z.object({
      chatbotId: z.string().uuid(),
      limit: z.number().int().min(1).max(50).default(10),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .query(async ({ ctx, input }) => {
    await assertOwnedChatbot(ctx, input.chatbotId);

    const firstUserMessages = ctx.db
      .select({
        conversationId: messages.conversationId,
        question: sql<string>`trim(${messages.content})`.as("question"),
        normalizedQuestion: sql<string>`lower(trim(${messages.content}))`.as(
          "normalized_question",
        ),
        rowNumber:
          sql<number>`row_number() over (partition by ${messages.conversationId} order by ${messages.createdAt} asc)`.as(
            "row_number",
          ),
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.chatbotId, input.chatbotId),
          eq(messages.role, "user"),
        ),
      )
      .as("first_user_messages");

    const groupedQuestions = ctx.db
      .select({
        question: sql<string>`MIN(${firstUserMessages.question})`.as(
          "question",
        ),
        count: sql<number>`count(*)::int`.as("count"),
      })
      .from(firstUserMessages)
      .where(
        and(
          sql`${firstUserMessages.rowNumber} = 1`,
          sql`${firstUserMessages.normalizedQuestion} <> ''`,
        ),
      )
      .groupBy(firstUserMessages.normalizedQuestion)
      .as("grouped_questions");

    const [total] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(groupedQuestions);

    const questions = await ctx.db
      .select()
      .from(groupedQuestions)
      .orderBy(desc(groupedQuestions.count), asc(groupedQuestions.question))
      .limit(input.limit)
      .offset(input.offset);

    return {
      questions: questions.map((q) => ({
        question: q.question,
        count: q.count,
      })),
      totalCount: total?.count ?? 0,
    };
  });

export const getLowConfidenceQueriesProcedure = protectedProcedure
  .input(
    z.object({
      chatbotId: z.string().uuid(),
      limit: z.number().int().min(1).max(50).default(10),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .query(async ({ ctx, input }) => {
    await assertOwnedChatbot(ctx, input.chatbotId);

    const sessionId = analyticsSessionId();
    const lowConfidenceWhere = and(
      eq(analytics.chatbotId, input.chatbotId),
      inArray(analytics.eventType, MESSAGE_EVENT_TYPES),
      sql`${analytics.eventData}->>'ragUsed' = 'false'`,
    );

    const [total] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(analytics)
      .where(lowConfidenceWhere);

    const rows = await ctx.db
      .select({
        id: analytics.id,
        sessionId,
        createdAt: analytics.createdAt,
        responseTime: sql<
          number | null
        >`(${analytics.eventData}->>'responseTime')::int`,
        sourcesCount: sql<
          number | null
        >`(${analytics.eventData}->>'sourcesCount')::int`,
        question: sql<string | null>`${analytics.eventData}->>'question'`,
      })
      .from(analytics)
      .where(lowConfidenceWhere)
      .orderBy(desc(analytics.createdAt), desc(analytics.id))
      .limit(input.limit)
      .offset(input.offset);

    return {
      queries: rows.map((row) => ({
        id: row.id,
        sessionId: row.sessionId,
        createdAt: row.createdAt,
        responseTime: row.responseTime,
        sourcesCount: row.sourcesCount,
        question: formatPreview(row.question) ?? "Question unavailable",
      })),
      totalCount: total?.count ?? 0,
    };
  });
