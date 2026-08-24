import type { StudyUIMessage } from "@/server/chat/study-tools";
import { extractText } from "@/lib/chat/ui-messages";
import { isRenderableQuiz, type Quiz, type QuizResponse } from "@/lib/quiz";
import type { StudyResponsePayload } from "@/lib/submit-study-response";

export interface ExportOptions {
  includeSources?: boolean;
  /** The student's own finished study-tool attempts, keyed by tool toolCallId. */
  studyAttempts?: Record<string, StudyResponsePayload[]>;
}

/**
 * The exportable text of a message: its joined text parts, or -- for a
 * quiz-only turn that has no text -- a placeholder so the export doesn't write a
 * blank `[N] Assistant:` line. (Turns with a renderable quiz get the full quiz
 * block appended separately; this is the fallback content line.)
 */
export function messageExportContent(message: StudyUIMessage): string {
  const text = extractText(message.parts);
  if (text.trim()) return text;
  const quiz = message.parts.find((p) => p.type === "tool-showQuiz");
  if (quiz) {
    const input = (quiz as { input?: { quiz_title?: unknown } }).input;
    // Mirror the client: an unrenderable quiz (failed validation or
    // out-of-range correct_index) showed an error notice, not a quiz, so the
    // export shouldn't claim an interactive quiz existed.
    if (!isRenderableQuiz(input as Quiz)) {
      return "[Quiz could not be generated]";
    }
    const title =
      typeof input?.quiz_title === "string" ? input.quiz_title : "quiz";
    return `[Interactive quiz: ${title}]`;
  }
  return text;
}

/** The renderable quizzes in a message, paired with the student's attempts. */
function messageQuizzes(
  message: StudyUIMessage,
  studyAttempts: Record<string, StudyResponsePayload[]> = {},
): Array<{ quiz: Quiz; attempts: QuizResponse[] }> {
  const out: Array<{ quiz: Quiz; attempts: QuizResponse[] }> = [];
  for (const part of message.parts) {
    if (
      part.type === "tool-showQuiz" &&
      (part.state === "input-available" || part.state === "output-available") &&
      isRenderableQuiz(part.input)
    ) {
      out.push({
        quiz: part.input,
        // This toolCallId belongs to a showQuiz part, so its attempts are quiz
        // responses.
        attempts: (studyAttempts[part.toolCallId] ?? []) as QuizResponse[],
      });
    }
  }
  return out;
}

/**
 * Human-readable block for one quiz: each question with its options (the correct
 * one marked), then the student's attempt(s) showing what they picked + score.
 * Pure + exported so it can be unit-tested.
 */
export function formatQuizForExport(
  quiz: Quiz,
  attempts: QuizResponse[],
): string {
  let s = `Quiz: ${quiz.quiz_title}\n`;
  quiz.questions.forEach((q, qi) => {
    s += `  Q${qi + 1}. ${q.question}\n`;
    q.options.forEach((opt, oi) => {
      const mark = oi === q.correct_index ? "  [correct]" : "";
      s += `      ${String.fromCharCode(65 + oi)}. ${opt}${mark}\n`;
    });
  });
  if (attempts.length === 0) {
    s += `  (no answer submitted)\n`;
    return s;
  }
  attempts.forEach((att, ai) => {
    s += `  Attempt ${ai + 1} — score ${att.score}/${att.total}:\n`;
    quiz.questions.forEach((q, qi) => {
      const chosen = att.answers[qi];
      const chosenText =
        typeof chosen === "number" && q.options[chosen] !== undefined
          ? q.options[chosen]
          : "(no answer)";
      const ok = chosen === q.correct_index ? "correct" : "incorrect";
      s += `      Q${qi + 1}: ${chosenText} (${ok})\n`;
    });
  });
  return s;
}

/** The full text body for a message: prose text and/or its quiz block(s). */
function messageExportBody(
  message: StudyUIMessage,
  studyAttempts: Record<string, StudyResponsePayload[]>,
): string {
  const quizzes = messageQuizzes(message, studyAttempts);
  if (quizzes.length === 0) return messageExportContent(message);
  const quizText = quizzes
    .map(({ quiz, attempts }) => formatQuizForExport(quiz, attempts))
    .join("\n");
  const text = extractText(message.parts);
  return text.trim() ? `${text}\n\n${quizText}` : quizText;
}

/** Flatten a UIMessage into the plain { role, content, sources } shape export needs. */
function toExportRows(
  messages: StudyUIMessage[],
  studyAttempts: Record<string, StudyResponsePayload[]> = {},
) {
  return messages.map((message) => ({
    role: message.role,
    content: messageExportBody(message, studyAttempts),
    sources: message.metadata?.sources,
    quizzes: messageQuizzes(message, studyAttempts),
  }));
}

/**
 * Exports chat messages as a formatted text file. When `studyAttempts` is
 * provided, each quiz turn includes its questions/correct answers and the
 * student's own submitted answers per attempt.
 */
export function exportChatAsText(
  uiMessages: StudyUIMessage[],
  chatbotName: string,
  options: ExportOptions = {},
): void {
  if (uiMessages.length === 0) {
    return;
  }
  const { includeSources = true, studyAttempts = {} } = options;
  const messages = toExportRows(uiMessages, studyAttempts);

  const date = new Date().toLocaleString();
  let content = `Chat Export: ${chatbotName}\n`;
  content += `Exported on: ${date}\n`;
  content += `${"=".repeat(60)}\n\n`;

  messages.forEach((message, index) => {
    const role = message.role === "user" ? "User" : "Assistant";
    content += `[${index + 1}] ${role}:\n`;
    content += `${message.content}\n`;

    // Include sources if available
    if (
      includeSources &&
      message.sources &&
      message.sources.length > 0 &&
      message.role === "assistant"
    ) {
      content += `\nSources:\n`;
      message.sources.forEach((source, sourceIndex) => {
        content += `  ${sourceIndex + 1}. ${source.fileName}`;
        if (source.similarity !== undefined) {
          content += ` (similarity: ${(source.similarity * 100).toFixed(1)}%)`;
        }
        content += `\n`;
      });
    }

    content += `\n${"-".repeat(60)}\n\n`;
  });

  // Create and download the file
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `chat-export-${chatbotName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${Date.now()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports chat messages as JSON. When `studyAttempts` is provided, each message
 * carries a structured `quizzes` array (quiz + the student's attempts).
 */
export function exportChatAsJSON(
  uiMessages: StudyUIMessage[],
  chatbotName: string,
  options: ExportOptions = {},
): void {
  if (uiMessages.length === 0) {
    return;
  }
  const { studyAttempts = {} } = options;
  const messages = toExportRows(uiMessages, studyAttempts);

  const exportData = {
    chatbotName,
    exportedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content,
      sources: message.sources,
      quizzes: message.quizzes.length > 0 ? message.quizzes : undefined,
    })),
  };

  const content = JSON.stringify(exportData, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `chat-export-${chatbotName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
