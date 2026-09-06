import type { Quiz } from "./schema";
import { repairQuiz } from "./repair";
import {
  extractPseudoCall,
  jsonCandidate,
  salvageTruncatedQuiz,
} from "./text-extraction";

/**
 * Recover a renderable quiz that a model emitted as text instead of a native
 * `showQuiz` tool call. Some (otherwise tool-capable) models serialize the tool
 * call into the assistant text channel; the AI SDK then forms no
 * `tool-showQuiz` part and the raw call renders as prose. Two shapes are
 * recovered: a JSON object (optionally in a ```json fence) and a pseudo-call
 * (`showQuiz(quiz_title=..., questions=[...])`). The JSON shape is tried first
 * -- it's the cheaper parse and the more common leak -- then the pseudo-call,
 * then a JSON leak the token limit truncated.
 *
 * Each candidate goes through `repairQuiz`, the same coercion the native
 * tool-call path applies (`experimental_repairToolCall` and
 * `repairQuizToolParts`). Without it this path was strictly stricter than the
 * tool-call path: a leak with a sixth question, a five-option question, one
 * botched question, or an aliased answer key (`answer: "B"`) was discarded
 * whole and the raw call -- answer keys, explanations and all -- was flushed to
 * the student as text. A leaked quiz now renders exactly when the same quiz
 * would have rendered had the model used the tool channel.
 *
 * Still returns null for anything that can't yield a renderable quiz, so
 * ordinary prose (or a non-quiz JSON code block) is left untouched: `repairQuiz`
 * requires a non-empty string `quiz_title` plus an array of questions, and
 * drops every question that won't render.
 */
export function parseQuizFromText(text: string): Quiz | null {
  const candidates = [
    jsonCandidate(text),
    extractPseudoCall(text),
    salvageTruncatedQuiz(text),
  ];
  for (const candidate of candidates) {
    if (candidate === null) continue;
    const quiz = repairQuiz(candidate);
    if (quiz) return quiz;
  }
  return null;
}
