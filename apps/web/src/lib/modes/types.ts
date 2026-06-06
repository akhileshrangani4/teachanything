import type { z } from "zod";

/**
 * Canonical set of structured-mode ids. This is the single source of truth for
 * the `messageType` literal: the registry, the persisted JSONB `messageType`
 * column (packages/db/src/schema.ts), the client `StructuredMessage` union
 * (types/database.ts), and the server persistence cast (routers/chat.ts) must
 * all agree with this. Typing `StructuredMode.id` as this union (rather than
 * `string`) makes a new/renamed mode a compile error in every consumer instead
 * of a silent runtime drift.
 */
export type StructuredModeId =
  | "quiz"
  | "flashcards"
  | "test"
  | "mindmap"
  | "matching";

/**
 * Descriptor for a "structured response mode" -- a chat mode where the model is
 * asked to return strict JSON, the stream is buffered, the JSON is validated, and
 * a structured widget is rendered instead of text. Quiz, Flashcard, Test, Mind
 * Map, and Matching modes all implement this shape; the registry drives
 * detection, parsing, persistence, and event emission from it.
 */
export interface StructuredMode<TPayload> {
  /** Stable key: used as both the `messageType` literal and the stream event mode id. */
  id: StructuredModeId;
  /**
   * Human-readable noun phrase for the confirmation prompt, e.g. "flashcard
   * deck", "quiz", "test", "mind map", "matching game". Used as
   * "Would you like me to make a ${label}?".
   */
  label: string;
  /** True when this user message should STRICTLY trigger generation (phase 2). */
  detect: (message: string) => boolean;
  /**
   * Build a canonical request phrase for a topic that is GUARANTEED to satisfy
   * this mode's strict `detect`. Sent when the student confirms (clicks Yes) so
   * phase 2 runs the normal generation pipeline. Must round-trip:
   * `detect(canonicalTrigger(topic))` is always true.
   */
  canonicalTrigger: (topic: string) => string;
  /** Appended to the system prompt to coax strict JSON from the model. */
  instruction: string;
  /** Zod schema the buffered JSON must satisfy. */
  schema: z.ZodType<TPayload>;
  /** Short human-readable label for the persisted `content` and the client message. */
  summarize: (payload: TPayload) => string;
  /** Friendly text shown if the model returns unparseable JSON. */
  fallbackMessage: string;
}
