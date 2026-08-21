import { z } from "zod";
import {
  mcQuestionSchema,
  coerceCorrectIndex,
  type MCQuestion,
} from "@/lib/questions";

/** Most questions a quiz may carry. Also the ceiling `repairQuiz` trims to. */
export const MAX_QUIZ_QUESTIONS = 5;

/** Longest quiz title. See the note on `quizSchema.quiz_title`. */
export const MAX_QUIZ_TITLE_LENGTH = 200;

/**
 * A multiple-choice quiz rendered as an interactive widget. Used as the
 * `inputSchema` of the `showQuiz` tool, so the model fills this in directly.
 */
export const quizSchema = z.object({
  // Bounded: the title is echoed into the professor dashboard, exports, and
  // (sanitized) the model results note, so an unbounded student-steerable
  // string is both a UI and prompt-size hazard.
  quiz_title: z.string().min(1).max(MAX_QUIZ_TITLE_LENGTH),
  questions: z.array(mcQuestionSchema).min(1).max(MAX_QUIZ_QUESTIONS),
});

export type QuizQuestion = MCQuestion;
export type Quiz = z.infer<typeof quizSchema>;

/**
 * True if every question's `correct_index` points at a real option.
 *
 * The schema can only bound `correct_index >= 0`: an upper bound
 * (`< options.length`) would have to be a cross-field zod refinement, and
 * refinements are stripped from the model-facing JSON schema -- the exact
 * problem the index design avoids. So a model can still emit an out-of-range
 * index; it is structurally valid (the SDK accepts it), but it would render a
 * quiz with no correct option and unwinnable scoring. Callers use this to treat
 * such a quiz as unrenderable (show an error notice + fall back to prose),
 * matching how a schema-invalid quiz is handled.
 */
export function isRenderableQuiz(quiz: Quiz): boolean {
  // Defensive: the server casts a tool-call `input` to `Quiz` before calling
  // this, so guard the shape rather than trusting it (a throw here would break
  // the stream). A valid call always satisfies the schema; anything else is,
  // by definition, not renderable.
  if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    return false;
  }
  return quiz.questions.every(
    (q) =>
      Array.isArray(q?.options) &&
      Number.isInteger(q.correct_index) &&
      q.correct_index >= 0 &&
      q.correct_index < q.options.length,
  );
}

/**
 * Extract the balanced span that starts at `start` (which must hold the opening
 * `{` or `[`). Returns the substring or null when the span never closes. Depth
 * counting skips brackets inside strings so a `}` or `]` in a question/option
 * can't end the span early.
 */
function extractBalanced(text: string, start: number): string | null {
  const open = text[start];
  if (open !== "{" && open !== "[") return null;
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Every complete `{...}` object inside the array that opens at `arrayStart`,
 * stopping at the first one that was cut off mid-write.
 *
 * Shared by both truncation salvages: a quiz the token limit interrupted arrives
 * either as JSON (`salvageTruncatedQuiz`) or as an unclosed pseudo-call
 * (`extractPseudoCall`), and in both shapes the questions that finished writing
 * are perfectly good.
 */
function collectClosedObjects(text: string, arrayStart: number): unknown[] {
  const objects: unknown[] = [];
  let cursor = arrayStart + 1;
  for (;;) {
    const objectStart = text.indexOf("{", cursor);
    if (objectStart === -1) break;
    const object = extractBalanced(text, objectStart);
    if (!object) break; // the question that was cut off mid-write
    try {
      objects.push(JSON.parse(object));
    } catch {
      break;
    }
    cursor = objectStart + object.length;
  }
  return objects;
}

/**
 * Extract the first balanced top-level `{...}` object from free text, unwrapping
 * a leading ```json fence if present. Returns the JSON substring or null.
 */
function extractJsonObject(raw: string): string | null {
  let text = raw;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1];
  const start = text.indexOf("{");
  if (start === -1) return null;
  return extractBalanced(text, start);
}

/**
 * Parse a `showQuiz` call the model wrote in its native pseudo-call syntax
 * instead of as a JSON object:
 *
 *   [showQuiz(quiz_title="Gender Quiz", questions=[ { "question": ... } ])]
 *
 * Llama-family models emit this shape when their tool-call channel isn't used,
 * so the whole call lands in the assistant text. Only the two keyword args are
 * read, in either order; the `questions` payload must be valid JSON (it is, in
 * practice -- these models serialize the array itself as JSON). Anything looser
 * is rejected rather than repaired, so ordinary prose can't be misread as a
 * quiz. Returns a candidate object for validation/repair, or null.
 *
 * A call the token limit cut off mid-write never closes its `questions` array.
 * Rather than discard a quiz that is almost entirely usable, keep the question
 * objects that finished -- the same salvage `salvageTruncatedQuiz` performs for
 * a truncated JSON leak.
 */
function extractPseudoCall(raw: string): unknown | null {
  const call = raw.match(/showQuiz\s*\(/);
  if (call?.index === undefined) return null;
  const body = raw.slice(call.index + call[0].length);

  const title = body.match(/quiz_title\s*[=:]\s*("(?:[^"\\]|\\.)*")/);
  const questionsKey = body.match(/questions\s*[=:]\s*\[/);
  if (!title?.[1] || questionsKey?.index === undefined) return null;

  const arrayStart = questionsKey.index + questionsKey[0].length - 1;
  const array = extractBalanced(body, arrayStart);

  let questions: unknown;
  if (array) {
    try {
      questions = JSON.parse(array) as unknown;
    } catch {
      return null;
    }
  } else {
    const salvaged = collectClosedObjects(body, arrayStart);
    if (salvaged.length === 0) return null;
    questions = salvaged;
  }

  try {
    return { quiz_title: JSON.parse(title[1]) as string, questions };
  } catch {
    return null;
  }
}

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

/**
 * Salvage a quiz from tool input the model never finished writing. A low
 * `maxTokens` on the chatbot cuts generation off mid-JSON, which leaves either
 * an unparseable input string or (when the args were streamed) no tool call at
 * all -- both of which the student sees as a failure even though the questions
 * that did arrive are perfectly good.
 *
 * So take the title and every question object that closed, and drop the one that
 * was still being written. Requires the title to have arrived: it is normally
 * the first key, and inventing one would put words in the professor's mouth.
 */
function salvageTruncatedQuiz(text: string): unknown | null {
  const title = text.match(/"quiz_title"\s*:\s*("(?:[^"\\]|\\.)*")/);
  const questionsKey = text.search(/"questions"\s*:\s*\[/);
  if (!title?.[1] || questionsKey === -1) return null;

  const questions = collectClosedObjects(text, text.indexOf("[", questionsKey));
  if (questions.length === 0) return null;

  try {
    return { quiz_title: JSON.parse(title[1]) as string, questions };
  } catch {
    return null;
  }
}

/**
 * Coerce whatever the model produced into a renderable quiz, dropping the parts
 * that can't render, or null when nothing usable is left.
 *
 * Tool input reaches us in three broken shapes, and all three currently show the
 * student "Couldn't build the quiz" even when most of the quiz is fine:
 *
 * - more questions than the schema allows (trimmed to `MAX_QUIZ_QUESTIONS`)
 * - individual malformed questions: missing explanation, too many options, a
 *   `correct_index` past the last option (dropped, the rest kept)
 * - input cut off mid-write by the token limit (see `salvageTruncatedQuiz`),
 *   arriving either as an unparseable string or as accumulated partial text
 *
 * A quiz that is already valid passes through unchanged, so callers can use this
 * as the single "can the client render this?" predicate.
 */
export function repairQuiz(input: unknown): Quiz | null {
  const candidate =
    typeof input === "string"
      ? (jsonCandidate(input) ?? salvageTruncatedQuiz(input))
      : input;
  if (typeof candidate !== "object" || candidate === null) return null;

  const { quiz_title: title, questions } = candidate as {
    quiz_title?: unknown;
    questions?: unknown;
  };
  if (typeof title !== "string" || title.trim().length === 0) return null;
  if (!Array.isArray(questions)) return null;

  const usable = questions
    // Models routinely name the answer field something other than
    // `correct_index`; fill it in before validating (see coerceCorrectIndex).
    .map(coerceCorrectIndex)
    .map((question) => mcQuestionSchema.safeParse(question))
    .filter(
      (parsed) =>
        parsed.success &&
        parsed.data.correct_index < parsed.data.options.length,
    )
    .map((parsed) => parsed.data)
    .slice(0, MAX_QUIZ_QUESTIONS);
  if (usable.length === 0) return null;

  const result = quizSchema.safeParse({
    quiz_title: title.slice(0, MAX_QUIZ_TITLE_LENGTH),
    questions: usable,
  });
  return result.success && isRenderableQuiz(result.data) ? result.data : null;
}

/** The first balanced `{...}` in `text`, JSON-parsed, or null. */
function jsonCandidate(text: string): unknown | null {
  const candidate = extractJsonObject(text);
  if (!candidate) return null;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

/**
 * A student's completed quiz attempt as stored in `study_tool_responses.response`.
 * `answers[i]` is the 0-based option index the student picked for question `i`,
 * in question order. `score`/`total` are derived server-side from the quiz
 * (never trusted from the client).
 */
export const quizResponseSchema = z.object({
  answers: z.array(z.number().int().min(0)),
  score: z.number().int().min(0),
  total: z.number().int().min(0),
});
export type QuizResponse = z.infer<typeof quizResponseSchema>;

/**
 * The interactive quiz widget's per-attempt local state: which question is
 * showing, the option index chosen per question (null until picked), and
 * whether the attempt is finished.
 */
export interface QuizWidgetState {
  currentIndex: number;
  selected: (number | null)[];
  finished: boolean;
}

/**
 * Seed the interactive widget's local state on mount. When the student has
 * already completed at least one attempt (persisted server-side and rehydrated
 * into the `attempts` prop by the parent), restore the finished/score view from
 * the most recent attempt. This makes the widget resilient to a remount that
 * keeps the surrounding chat mounted -- most notably the embed widget, which
 * unmounts its chat subtree (`return null`) when hidden on a tab switch and
 * remounts on reopen. Without this the local `useState` reseeds to question 1,
 * throwing away a finished quiz. With no valid prior attempt, start fresh.
 */
export function initialQuizWidgetState(
  total: number,
  attempts: QuizResponse[] | undefined,
): QuizWidgetState {
  const last =
    attempts && attempts.length > 0 ? attempts[attempts.length - 1] : undefined;
  // Only restore when the stored answers line up with this quiz (they always
  // should -- same quiz, same toolCallId -- but a mismatch would mis-score the
  // finished view, so fall back to a fresh start instead).
  if (last && last.answers.length === total) {
    return {
      currentIndex: Math.max(0, total - 1),
      selected: [...last.answers],
      finished: true,
    };
  }
  return {
    currentIndex: 0,
    selected: Array(total).fill(null),
    finished: false,
  };
}

/**
 * True if `answers` is a well-formed set of selections for `quiz`: one entry per
 * question, each a 0-based index into that question's options. Used at the
 * capture boundary before grading/storing.
 */
export function isValidQuizAnswers(quiz: Quiz, answers: number[]): boolean {
  if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
    return false;
  }
  return quiz.questions.every((q, i) => {
    const a = answers[i];
    return (
      Number.isInteger(a) && a !== undefined && a >= 0 && a < q.options.length
    );
  });
}

/**
 * Grade a set of answers against the quiz. Assumes `isValidQuizAnswers` already
 * passed. Score is computed here (server-side) rather than trusting a
 * client-sent value.
 */
export function gradeQuiz(quiz: Quiz, answers: number[]): QuizResponse {
  const total = quiz.questions.length;
  const score = quiz.questions.reduce(
    (acc, q, i) => (answers[i] === q.correct_index ? acc + 1 : acc),
    0,
  );
  return { answers, score, total };
}
