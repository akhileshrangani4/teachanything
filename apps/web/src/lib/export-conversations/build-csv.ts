import { renderStudyToolsText } from "@/lib/study-tool-export";
import type { ConversationsExport } from "./types";
import {
  csvCell,
  formatDateTime,
  formatSimilarity,
  roleLabel,
} from "./format-helpers";

export function buildCsv(data: ConversationsExport): string {
  const header = [
    "conversation_number",
    "conversation_id",
    "session_id",
    "conversation_started",
    "turn",
    "role",
    "timestamp",
    "message",
    "sources",
    "study_tools",
  ];

  // CRLF + a UTF-8 BOM so Excel opens accented / non-ASCII content correctly.
  const rows: string[] = [header.map(csvCell).join(",")];

  data.conversations.forEach((conversation, index) => {
    const started = formatDateTime(conversation.createdAt);
    conversation.messages.forEach((message, messageIndex) => {
      const sources = message.sources
        .map((s) => `${s.fileName} (${formatSimilarity(s.similarity)})`)
        .join("; ");
      rows.push(
        [
          String(index + 1),
          conversation.id,
          conversation.sessionId,
          started,
          String(messageIndex + 1),
          roleLabel(message.role),
          formatDateTime(message.createdAt),
          message.content,
          sources,
          renderStudyToolsText(message.studyTools ?? []),
        ]
          .map(csvCell)
          .join(","),
      );
    });
  });

  return `\uFEFF${rows.join("\r\n")}`;
}
