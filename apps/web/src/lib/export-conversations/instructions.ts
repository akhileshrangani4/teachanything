import type { ConversationsExport, ExportFormat } from "./types";
import {
  FORMAT_FILENAMES,
  FORMAT_LABELS,
  formatDateTime,
} from "./format-helpers";

// ---------------------------------------------------------------------------
// README / instructions (adapts to the chosen formats)
// ---------------------------------------------------------------------------

export function buildInstructions(
  data: ConversationsExport,
  formats: ExportFormat[],
): string {
  const lines: string[] = [];
  lines.push("Teach Anything — Chat Records Export");
  lines.push("=".repeat(40));
  lines.push("");
  lines.push(`Chatbot:        ${data.chatbotName}`);
  lines.push(`Exported:       ${formatDateTime(data.exportedAt)}`);
  lines.push(`Conversations:  ${data.conversations.length}`);
  lines.push("");

  if (data.truncated) {
    lines.push(
      `NOTE: This export was capped at the first ${data.maxConversations} conversations.`,
    );
    lines.push(
      "      This chatbot has more records. Export in smaller selections",
    );
    lines.push("      to capture the remainder.");
    lines.push("");
  }

  lines.push("This bundle contains:");
  lines.push("");
  for (const format of formats) {
    lines.push(`  • ${FORMAT_FILENAMES[format]} — ${FORMAT_LABELS[format]}`);
  }
  lines.push("");
  lines.push("How to use each file");
  lines.push("-".repeat(40));

  if (formats.includes("html")) {
    lines.push("");
    lines.push(`${FORMAT_FILENAMES.html}`);
    lines.push(
      "  Double-click to open in any web browser. Conversations are laid",
    );
    lines.push(
      "  out as a readable chat transcript — student messages on the right,",
    );
    lines.push("  the chatbot's replies on the left, with timestamps and any");
    lines.push("  sources the chatbot cited.");
  }
  if (formats.includes("csv")) {
    lines.push("");
    lines.push(`${FORMAT_FILENAMES.csv}`);
    lines.push(
      "  Open in Excel or Google Sheets. One row per message, with columns",
    );
    lines.push(
      "  for the conversation number/id, session, turn, role, timestamp,",
    );
    lines.push(
      "  message text and cited sources — handy for filtering and analysis.",
    );
  }
  if (formats.includes("text")) {
    lines.push("");
    lines.push(`${FORMAT_FILENAMES.text}`);
    lines.push(
      "  Open in any text editor. Plain, portable transcript grouped by",
    );
    lines.push("  conversation, each turn labeled Student / Assistant.");
  }

  lines.push("");
  lines.push(
    "Interactive study tools a student used (e.g. quizzes) appear inline in",
  );
  lines.push(
    "each format: the questions, the correct answers, and the student's own",
  );
  lines.push("responses and score for each attempt.");

  lines.push("");
  lines.push("-".repeat(40));
  lines.push(
    "Records are exported for pedagogical and research use. Please handle",
  );
  lines.push("student data responsibly and in line with your institution's");
  lines.push("privacy policies.");
  lines.push("");

  return lines.join("\n");
}
