import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import type { db as DbType } from "@teachanything/db";
import {
  conversations,
  messages,
  studyToolResponses,
} from "@teachanything/db/schema";
import {
  quizSchema,
  isValidQuizAnswers,
  gradeQuiz,
  type Quiz,
} from "@/lib/quiz";

/** Mirror the chat send-path session id bound (client-minted nanoid). */
const sessionIdSchema = z
  .string()
  .min(10)
  .max(30)
  .regex(/^[a-zA-Z0-9_-]+$/);

/** A quiz has at most 5 questions; cap the answers array a bit above that. */
const answersSchema = z.array(z.number().int()).max(16);

export class StudyRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StudyRequestError";
  }
}

/**
 * A student's study-tool response from the client. `toolName` is a literal so
 * new tools are added deliberately (each with its own answer validation). Only
 * `showQuiz` exists in Phase 1. The score is NOT accepted from the client -- it
 * is graded server-side from the persisted quiz.
 */
const baseStudyRequestSchema = z.object({
  sessionId: sessionIdSchema,
  toolCallId: z.string().min(1).max(200),
  toolName: z.literal("showQuiz"),
  answers: answersSchema,
});

export const authedStudyRequestSchema = baseStudyRequestSchema.extend({
  chatbotId: z.string().uuid(),
});

export const sharedStudyRequestSchema = baseStudyRequestSchema.extend({
  shareToken: z.string().min(1).max(100),
});

type StudyMessageRow = { metadata: unknown };

/**
 * Find the quiz that was shown for `toolCallId` in a conversation's persisted
 * messages. The assistant turn stores its UI parts in `metadata.parts`, and a
 * rendered quiz is a `tool-showQuiz` part carrying the quiz as its `input`. The
 * `toolCallId` is stable across the live stream and persistence, so it links an
 * attempt to the exact quiz. Returns null when no such (valid) quiz exists,
 * which the caller treats as an unknown/forged tool-call id.
 */
export function findQuizByToolCallId(
  rows: StudyMessageRow[],
  toolCallId: string,
): Quiz | null {
  for (const row of rows) {
    const parts = (row.metadata as { parts?: unknown[] } | null)?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      const p = part as {
        type?: unknown;
        toolCallId?: unknown;
        input?: unknown;
      };
      if (p.type === "tool-showQuiz" && p.toolCallId === toolCallId) {
        const parsed = quizSchema.safeParse(p.input);
        if (parsed.success) return parsed.data;
      }
    }
  }
  return null;
}

/**
 * Validate + persist one study-tool attempt. Resolves the conversation from
 * (chatbot, session), confirms the `toolCallId` was actually shown in it,
 * grades the answers server-side, and appends a `study_tool_responses` row. The
 * attempt number is derived server-side (existing count + 1) so the client
 * can't spoof ordering. Throws `StudyRequestError` on any validation failure.
 */
export async function recordStudyResponse(params: {
  chatbotId: string;
  sessionId: string;
  toolCallId: string;
  toolName: "showQuiz";
  answers: number[];
  db: typeof DbType;
}): Promise<{ attempt: number }> {
  const { chatbotId, sessionId, toolCallId, answers, db } = params;

  const [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.chatbotId, chatbotId),
        eq(conversations.sessionId, sessionId),
      ),
    )
    .limit(1);
  if (!conversation) {
    throw new StudyRequestError("Conversation not found", 404);
  }

  const rows = await db
    .select({ metadata: messages.metadata })
    .from(messages)
    .where(eq(messages.conversationId, conversation.id));

  const quiz = findQuizByToolCallId(rows, toolCallId);
  if (!quiz) {
    // Either the quiz turn isn't persisted yet or the id doesn't belong to this
    // conversation. Both are 404: we won't store an attempt we can't grade.
    throw new StudyRequestError("Quiz not found for this conversation", 404);
  }

  if (!isValidQuizAnswers(quiz, answers)) {
    throw new StudyRequestError("Answers do not match the quiz", 400);
  }

  const response = gradeQuiz(quiz, answers);

  const [existing] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(studyToolResponses)
    .where(
      and(
        eq(studyToolResponses.conversationId, conversation.id),
        eq(studyToolResponses.toolCallId, toolCallId),
      ),
    );
  const attempt = (existing?.count ?? 0) + 1;

  await db.insert(studyToolResponses).values({
    conversationId: conversation.id,
    toolCallId,
    toolName: "showQuiz",
    attempt,
    response,
  });

  return { attempt };
}
