import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import type { db as DbType } from "@teachanything/db";
import {
  conversations,
  messages,
  studyToolResponses,
} from "@teachanything/db/schema";
import { StudyRequestError } from "./errors";
import { STUDY_TOOL_HANDLERS } from "./handlers";

export { StudyRequestError };

/** Mirror the chat send-path session id bound (client-minted nanoid). */
const sessionIdSchema = z
  .string()
  .min(10)
  .max(30)
  .regex(/^[a-zA-Z0-9_-]+$/);

/**
 * A student's study-tool response from the client. The `response` shape is
 * tool-specific and validated server-side by the tool's handler, so it's
 * `unknown` at the boundary. The tool NAME is NOT taken from the client -- it is
 * derived from the persisted tool part for `toolCallId`, so a caller can't route
 * a payload to the wrong handler.
 */
const baseStudyRequestSchema = z.object({
  sessionId: sessionIdSchema,
  toolCallId: z.string().min(1).max(200),
  response: z.unknown(),
});

export const authedStudyRequestSchema = baseStudyRequestSchema.extend({
  chatbotId: z.string().uuid(),
});

export const sharedStudyRequestSchema = baseStudyRequestSchema.extend({
  shareToken: z.string().min(1).max(100),
});

type StudyMessageRow = { metadata: unknown };

/**
 * Find the study-tool part for `toolCallId` in a conversation's persisted
 * messages, returning its tool name and the input that was shown. The assistant
 * turn stores its UI parts in `metadata.parts`, and a rendered study tool is a
 * `tool-<name>` part carrying its payload as `input`. The `toolCallId` is stable
 * across the live stream and persistence, so it links a response to the exact
 * tool instance. Tool-agnostic: works for any `tool-*` part. Returns null when
 * no such part exists (an unknown/forged tool-call id).
 */
export function findToolPartByToolCallId(
  rows: StudyMessageRow[],
  toolCallId: string,
): { toolName: string; input: unknown } | null {
  for (const row of rows) {
    const parts = (row.metadata as { parts?: unknown[] } | null)?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      const p = part as {
        type?: unknown;
        toolCallId?: unknown;
        input?: unknown;
      };
      if (
        typeof p.type === "string" &&
        p.type.startsWith("tool-") &&
        p.toolCallId === toolCallId
      ) {
        return { toolName: p.type.slice("tool-".length), input: p.input };
      }
    }
  }
  return null;
}

/**
 * Validate + persist one study-tool response. Resolves the conversation from
 * (chatbot, session), confirms the `toolCallId` was actually shown in it,
 * derives the tool name from that part, hands the raw client response to the
 * tool's registered handler (which validates + grades server-side), and appends
 * a `study_tool_responses` row. The attempt number is derived server-side
 * (existing count + 1). Throws `StudyRequestError` on any validation failure.
 */
export async function recordStudyResponse(params: {
  chatbotId: string;
  sessionId: string;
  toolCallId: string;
  response: unknown;
  db: typeof DbType;
}): Promise<{ attempt: number; toolName: string }> {
  const { chatbotId, sessionId, toolCallId, response, db } = params;

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

  const part = findToolPartByToolCallId(rows, toolCallId);
  if (!part) {
    // Either the tool turn isn't persisted yet or the id doesn't belong to this
    // conversation. Both are 404: we won't store a response we can't attribute.
    throw new StudyRequestError(
      "Study tool not found for this conversation",
      404,
    );
  }

  const handler = STUDY_TOOL_HANDLERS[part.toolName];
  if (!handler) {
    throw new StudyRequestError("Unsupported study tool", 400);
  }

  // Validates the client response against the shown input and grades it; throws
  // StudyRequestError on invalid input.
  const stored = handler.buildResponse(part.input, response);

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
    toolName: part.toolName,
    attempt,
    response: stored,
  });

  return { attempt, toolName: part.toolName };
}
