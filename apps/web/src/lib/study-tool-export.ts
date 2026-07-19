import {
  isRenderableQuiz,
  quizResponseSchema,
  type Quiz,
  type QuizResponse,
} from "@/lib/quiz";
import { formatQuizForExport } from "@/lib/export-chat";

/**
 * Renders study-tool widgets (quizzes now; flashcards / test / mindmap / ...
 * later) for the chat-records export. The export pipeline stays tool-agnostic:
 * it hands each widget here as a generic {@link ExportStudyTool}, and this
 * module picks a per-tool renderer by `toolName`. Adding a new study tool means
 * registering one renderer here -- no changes to the server export or the
 * HTML/CSV/text builders.
 *
 * Unknown tools fall back to a lossless generic renderer so a new component is
 * never silently dropped from an export before its renderer is written.
 */

/** One student attempt at a study tool; `response` shape is per-tool. */
export interface ExportStudyToolResponse {
  attempt: number;
  response: unknown;
}

/** A study-tool widget shown in an assistant turn, with the student's attempts. */
export interface ExportStudyTool {
  toolName: string;
  input: unknown;
  responses: ExportStudyToolResponse[];
}

interface StudyToolRenderer {
  /** Plain-text block (used by the .txt export and inside CSV cells). */
  text(tool: ExportStudyTool): string;
  /** Safe HTML block (already escaped). */
  html(tool: ExportStudyTool): string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// --- Quiz (showQuiz) ------------------------------------------------------

/** Student attempts for a quiz tool, validated and ordered by attempt number. */
function quizAttempts(tool: ExportStudyTool): QuizResponse[] {
  return [...tool.responses]
    .sort((a, b) => a.attempt - b.attempt)
    .map((r) => quizResponseSchema.safeParse(r.response))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []));
}

const quizRenderer: StudyToolRenderer = {
  text(tool) {
    if (!isRenderableQuiz(tool.input as Quiz)) {
      return "[Quiz could not be generated]";
    }
    // Reuse the in-chat export formatter so both exports read identically.
    return formatQuizForExport(
      tool.input as Quiz,
      quizAttempts(tool),
    ).trimEnd();
  },
  html(tool) {
    if (!isRenderableQuiz(tool.input as Quiz)) {
      return `<div class="study-tool"><div class="dim">[Quiz could not be generated]</div></div>`;
    }
    const quiz = tool.input as Quiz;
    const attempts = quizAttempts(tool);

    const questions = quiz.questions
      .map((q, qi) => {
        const options = q.options
          .map((opt, oi) => {
            const correct = oi === q.correct_index;
            return `<li class="opt${correct ? " correct" : ""}">${optionLetter(oi)}. ${escapeHtml(opt)}${
              correct ? ` <span class="tag ok">correct</span>` : ""
            }</li>`;
          })
          .join("");
        return `<li><div class="q">Q${qi + 1}. ${escapeHtml(q.question)}</div><ul class="opts">${options}</ul><div class="explanation">${escapeHtml(q.explanation)}</div></li>`;
      })
      .join("");

    const attemptsHtml =
      attempts.length === 0
        ? `<div class="dim">No answer submitted.</div>`
        : attempts
            .map((att, ai) => {
              const rows = quiz.questions
                .map((q, qi) => {
                  const chosen = att.answers[qi];
                  const chosenText =
                    typeof chosen === "number" &&
                    q.options[chosen] !== undefined
                      ? q.options[chosen]
                      : "(no answer)";
                  const ok = chosen === q.correct_index;
                  return `<li>Q${qi + 1}: ${escapeHtml(chosenText)} <span class="tag ${ok ? "ok" : "bad"}">${ok ? "correct" : "incorrect"}</span></li>`;
                })
                .join("");
              return `<div class="attempt"><div class="attempt-head">Attempt ${ai + 1} — score ${att.score}/${att.total}</div><ul>${rows}</ul></div>`;
            })
            .join("");

    return `<div class="study-tool quiz"><div class="tool-label">Quiz: ${escapeHtml(quiz.quiz_title)}</div><ol class="quiz-questions">${questions}</ol>${attemptsHtml}</div>`;
  },
};

// --- Generic fallback -----------------------------------------------------

const genericRenderer: StudyToolRenderer = {
  text(tool) {
    const lines = [`[Study tool: ${tool.toolName}]`];
    if (tool.input != null) lines.push(`  Data: ${safeJson(tool.input)}`);
    [...tool.responses]
      .sort((a, b) => a.attempt - b.attempt)
      .forEach((r) =>
        lines.push(`  Attempt ${r.attempt}: ${safeJson(r.response)}`),
      );
    return lines.join("\n");
  },
  html(tool) {
    const parts = [
      `<div class="tool-label">Study tool: ${escapeHtml(tool.toolName)}</div>`,
    ];
    if (tool.input != null) {
      parts.push(
        `<pre class="tool-raw">${escapeHtml(safeJson(tool.input))}</pre>`,
      );
    }
    [...tool.responses]
      .sort((a, b) => a.attempt - b.attempt)
      .forEach((r) =>
        parts.push(
          `<div class="attempt"><div class="attempt-head">Attempt ${r.attempt}</div><pre class="tool-raw">${escapeHtml(safeJson(r.response))}</pre></div>`,
        ),
      );
    return `<div class="study-tool">${parts.join("")}</div>`;
  },
};

const RENDERERS: Record<string, StudyToolRenderer> = {
  showQuiz: quizRenderer,
};

function rendererFor(toolName: string): StudyToolRenderer {
  return RENDERERS[toolName] ?? genericRenderer;
}

/** Joined plain-text blocks for a turn's study tools ("" when there are none). */
export function renderStudyToolsText(tools: ExportStudyTool[]): string {
  return tools
    .map((tool) => rendererFor(tool.toolName).text(tool))
    .join("\n\n");
}

/** Joined HTML blocks for a turn's study tools ("" when there are none). */
export function renderStudyToolsHtml(tools: ExportStudyTool[]): string {
  return tools.map((tool) => rendererFor(tool.toolName).html(tool)).join("\n");
}
