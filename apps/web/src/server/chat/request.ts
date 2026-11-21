import { z } from "zod";
import { nanoid } from "nanoid";
import type { StudyUIMessage } from "./study-tools";
import { sessionIdSchema } from "@/server/utils";
import type { ChatErrorCode } from "@/lib/chat-error-message";

/** Matches the prior tRPC `message` bound (z.string().min(1).max(16000)). */
const MAX_MESSAGE_CHARS = 16000;

export class ChatRequestError extends Error {
  constructor(
    readonly code: ChatErrorCode,
    readonly status: number,
  ) {
    super(code);
    this.name = "ChatRequestError";
  }
}

/** A chat route's error. The client translates the code. */
export function chatErrorResponse(code: ChatErrorCode, status: number) {
  return Response.json({ code }, { status });
}

/**
 * The incoming message is an `@ai-sdk/react` UIMessage the client fully
 * controls. We deliberately validate it loosely here and then REBUILD a trusted
 * user message server-side (see `buildUserMessage`): the wire `role` and any
 * non-text / tool parts are never trusted, so a caller (especially on the
 * unauthenticated /shared route) cannot inject a `role:"system"` turn or plant
 * arbitrary parts into history/persistence.
 */
const incomingMessageSchema = z.object({
  role: z.string().optional(),
  // Bound the array length and per-part text so an oversized payload is rejected
  // at the boundary instead of being filtered/joined before the length cap.
  parts: z
    .array(
      z.object({
        type: z.string(),
        text: z.string().max(MAX_MESSAGE_CHARS).optional(),
      }),
    )
    .max(64)
    .optional(),
});

const optionalSessionIdSchema = sessionIdSchema.optional();

export const authedChatRequestSchema = z.object({
  message: incomingMessageSchema,
  sessionId: optionalSessionIdSchema,
  chatbotId: z.string().uuid(),
});

export const sharedChatRequestSchema = z.object({
  message: incomingMessageSchema,
  sessionId: optionalSessionIdSchema,
  shareToken: z.string().min(1).max(100),
});

/**
 * Build a trusted user UIMessage from the (validated) client message: force
 * `role: "user"`, keep only text parts, and cap the length. Returns `null` when
 * there is no usable text (the caller returns 400) -- mirrors the old
 * `message.min(1)` bound.
 */
export function buildUserMessage(
  raw: z.infer<typeof incomingMessageSchema>,
): StudyUIMessage | null {
  const text = (raw.parts ?? [])
    .filter(
      (p): p is { type: "text"; text: string } =>
        p.type === "text" && typeof p.text === "string",
    )
    .map((p) => p.text)
    .join("\n")
    .slice(0, MAX_MESSAGE_CHARS);

  if (!text.trim()) return null;

  return {
    id: nanoid(),
    role: "user",
    parts: [{ type: "text", text }],
  };
}
