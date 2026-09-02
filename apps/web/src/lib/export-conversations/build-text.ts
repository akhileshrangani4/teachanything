import { renderStudyToolsText } from "@/lib/study-tool-export";
import type { ConversationsExport } from "./types";
import { formatDateTime, formatSimilarity, roleLabel } from "./format-helpers";

export function buildText(data: ConversationsExport): string {
  const lines: string[] = [];
  lines.push(`Chat Records: ${data.chatbotName}`);
  lines.push(`Exported: ${formatDateTime(data.exportedAt)}`);
  lines.push(`Conversations: ${data.conversations.length}`);
  lines.push("=".repeat(60));
  lines.push("");

  if (data.conversations.length === 0) {
    lines.push("No chat records to export.");
    return lines.join("\n");
  }

  data.conversations.forEach((conversation, index) => {
    lines.push(
      `=== Conversation ${index + 1} of ${data.conversations.length} ===`,
    );
    lines.push(`Session: ${conversation.sessionId}`);
    lines.push(`Started: ${formatDateTime(conversation.createdAt)}`);
    lines.push(`Messages: ${conversation.messages.length}`);
    lines.push("");

    conversation.messages.forEach((message, messageIndex) => {
      lines.push(`[${messageIndex + 1}] ${roleLabel(message.role)}:`);
      // Quiz-only turns have empty text content; skip the blank line.
      if (message.content.trim()) {
        lines.push(message.content);
      }
      const studyText = renderStudyToolsText(message.studyTools ?? []);
      if (studyText) {
        studyText.split("\n").forEach((line) => lines.push(line));
      }
      if (message.role === "assistant" && message.sources.length > 0) {
        lines.push("  Sources:");
        message.sources.forEach((source, sourceIndex) => {
          lines.push(
            `    ${sourceIndex + 1}. ${source.fileName} (${formatSimilarity(source.similarity)})`,
          );
        });
      }
      lines.push("");
    });

    lines.push("-".repeat(60));
    lines.push("");
  });

  return lines.join("\n");
}
