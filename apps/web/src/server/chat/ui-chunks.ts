import type { InferUIMessageChunk } from "ai";
import type { StudyUIMessage } from "./study-tools";

/**
 * The UI message chunk shape used across the chat streaming pipeline.
 * Single source of truth: recover-quiz, repair-quiz-parts and
 * primary-turn all operate on this stream.
 */
export type Chunk = InferUIMessageChunk<StudyUIMessage>;
