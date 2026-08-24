import { z } from "zod";
import { nanoid } from "nanoid";
import type { StudyUIMessage } from "./study-tools";

/** Matches the prior tRPC `message` bound (z.string().min(1).max(16000)). */
const MAX_MESSAGE_CHARS = 16000;

export class ChatRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ChatRequestError";
  }
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

/** Session ids are client-minted nanoids; mirror the prior tRPC bound. */
const sessionIdSchema = z
  .string()
  .min(10)
  .max(30)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .optional();

export const authedChatRequestSchema = z.object({
  message: incomingMessageSchema,
  sessionId: sessionIdSchema,
  chatbotId: z.string().uuid(),
});

export const sharedChatRequestSchema = z.object({
  message: incomingMessageSchema,
  sessionId: sessionIdSchema,
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
