import { z } from "zod";
import { mcQuestionSchema, type MCQuestion } from "@/lib/questions";

/**
 * A multiple-choice quiz rendered as an interactive widget. Used as the
 * `inputSchema` of the `showQuiz` tool, so the model fills this in directly.
 */
export const quizSchema = z.object({
  // Bounded: the title is echoed into the professor dashboard, exports, and
  // (sanitized) the model results note, so an unbounded student-steerable
  // string is both a UI and prompt-size hazard.
  quiz_title: z.string().min(1).max(200),
  questions: z.array(mcQuestionSchema).min(1).max(5),
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
 * Extract the first balanced top-level `{...}` object from free text, unwrapping
 * a leading ```json fence if present. Returns the JSON substring or null. Brace
 * counting skips braces inside strings so a `}` in a question/option can't end
 * the object early.
 */
function extractJsonObject(raw: string): string | null {
  let text = raw;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1];
  const start = text.indexOf("{");
  if (start === -1) return null;
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
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Recover a renderable quiz that a model emitted as a text JSON blob instead of
 * a native `showQuiz` tool call. Some (otherwise tool-capable) models serialize
 * the tool call into the assistant text channel; the AI SDK then forms no
 * `tool-showQuiz` part and the raw JSON renders as prose. This parses that text
 * back into a quiz so the server can reconstruct the tool part. Returns null for
 * anything that isn't a structurally valid, renderable quiz -- so ordinary prose
 * (or a non-quiz JSON code block) is left untouched.
 */
export function parseQuizFromText(text: string): Quiz | null {
  const candidate = extractJsonObject(text);
  if (!candidate) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }
  const result = quizSchema.safeParse(parsed);
  if (!result.success) return null;
  return isRenderableQuiz(result.data) ? result.data : null;
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
