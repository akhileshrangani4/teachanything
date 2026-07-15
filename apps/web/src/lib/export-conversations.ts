import { strToU8, zipSync } from "fflate";

/**
 * Turns a chatbot's exported chat records (from
 * `analytics.exportConversations`) into downloadable files. The professor
 * picks any combination of HTML / CSV / plain text in the Student Chats tab;
 * we always add a README that documents *only* the formats they chose, then
 * bundle everything into a single .zip download.
 *
 * The builders here are pure (data in, string out) so they can be unit-tested
 * without a DOM. Only `downloadConversationsExport` touches the browser.
 */

export type ExportFormat = "html" | "csv" | "text";

export interface ExportSource {
  fileName: string;
  similarity: number;
}

export interface ExportMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string | Date;
  sources: ExportSource[];
}

export interface ExportConversation {
  id: string;
  sessionId: string;
  createdAt: string | Date;
  messages: ExportMessage[];
}

export interface ConversationsExport {
  chatbotName: string;
  exportedAt: string | Date;
  truncated: boolean;
  maxConversations: number;
  conversations: ExportConversation[];
}

const FORMAT_FILENAMES: Record<ExportFormat, string> = {
  html: "chat-records.html",
  csv: "chat-records.csv",
  text: "chat-records.txt",
};

const FORMAT_LABELS: Record<ExportFormat, string> = {
  html: "Visual transcript (open in any web browser)",
  csv: "Spreadsheet (open in Excel / Google Sheets)",
  text: "Plain text (open in any text editor)",
};

// "Student" reads more clearly than "user" for the professor-facing export;
// the assistant is the chatbot's reply.
function roleLabel(role: "user" | "assistant"): string {
  return role === "user" ? "Student" : "Assistant";
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function formatDateTime(value: string | Date): string {
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function slugify(name: string): string {
  const slug = name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return slug.toLowerCase() || "chatbot";
}

function formatSimilarity(similarity: number): string {
  return `${(similarity * 100).toFixed(1)}%`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * RFC-4180-style CSV cell: wrap in quotes and double any embedded quotes so
 * commas, quotes and newlines inside message content stay in one cell.
 *
 * Also guards against spreadsheet formula injection: a value starting with
 * `=`, `+`, `-`, `@` (or a leading tab/CR) makes Excel / Google Sheets treat
 * the cell as a formula. Prefixing with an apostrophe forces it to text; both
 * Excel and Sheets hide that apostrophe, so the professor still reads the
 * original content unchanged.
 */
function csvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/** Human-readable count helper: "1 conversation" / "3 conversations". */
function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

// ---------------------------------------------------------------------------
// Plain text
// ---------------------------------------------------------------------------

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
      lines.push(message.content);
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

// ---------------------------------------------------------------------------
// CSV (one row per message)
// ---------------------------------------------------------------------------

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
        ]
          .map(csvCell)
          .join(","),
      );
    });
  });

  return `\uFEFF${rows.join("\r\n")}`;
}

// ---------------------------------------------------------------------------
// HTML (visual transcript)
// ---------------------------------------------------------------------------

function renderMessageHtml(message: ExportMessage, turn: number): string {
  const side = message.role === "user" ? "student" : "assistant";
  const body = escapeHtml(message.content).replace(/\n/g, "<br>");
  const sources =
    message.role === "assistant" && message.sources.length > 0
      ? `<div class="sources">Sources: ${message.sources
          .map(
            (s) =>
              `${escapeHtml(s.fileName)} (${formatSimilarity(s.similarity)})`,
          )
          .join(", ")}</div>`
      : "";
  return `<div class="msg ${side}">
      <div class="meta">${turn}. ${roleLabel(message.role)} · ${escapeHtml(formatDateTime(message.createdAt))}</div>
      <div class="bubble">${body}</div>
      ${sources}
    </div>`;
}

function renderConversationHtml(
  conversation: ExportConversation,
  index: number,
  total: number,
): string {
  const messages = conversation.messages
    .map((message, messageIndex) =>
      renderMessageHtml(message, messageIndex + 1),
    )
    .join("\n");
  return `<section class="conversation">
    <header>
      <h2>Conversation ${index + 1} <span class="dim">of ${total}</span></h2>
      <div class="dim">Session ${escapeHtml(conversation.sessionId)} · Started ${escapeHtml(formatDateTime(conversation.createdAt))} · ${plural(conversation.messages.length, "message")}</div>
    </header>
    ${messages || '<p class="dim">No messages in this conversation.</p>'}
  </section>`;
}

export function buildHtml(data: ConversationsExport): string {
  const title = `Chat Records — ${escapeHtml(data.chatbotName)}`;
  const body =
    data.conversations.length === 0
      ? '<p class="dim">No chat records to export.</p>'
      : data.conversations
          .map((conversation, index) =>
            renderConversationHtml(
              conversation,
              index,
              data.conversations.length,
            ),
          )
          .join("\n");

  const truncatedNote = data.truncated
    ? `<p class="notice">Showing the first ${data.maxConversations} conversations. This chatbot has more; export in smaller selections to capture the rest.</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; margin: 0; background: #f6f7f9; color: #1a1a1a; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 2rem 1rem 4rem; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
  h2 { font-size: 1.1rem; margin: 0; }
  .dim { color: #6b7280; font-weight: 400; font-size: .85rem; }
  .summary { color: #374151; margin: 0 0 2rem; }
  .notice { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: .75rem 1rem; border-radius: .5rem; font-size: .9rem; }
  .conversation { background: #fff; border: 1px solid #e5e7eb; border-radius: .75rem; padding: 1.25rem; margin-bottom: 1.5rem; }
  .conversation > header { margin-bottom: 1rem; padding-bottom: .75rem; border-bottom: 1px solid #eef0f2; }
  .msg { margin: .75rem 0; display: flex; flex-direction: column; }
  .msg.student { align-items: flex-end; }
  .msg.assistant { align-items: flex-start; }
  .msg .meta { font-size: .75rem; color: #9ca3af; margin-bottom: .2rem; }
  .bubble { max-width: 85%; padding: .6rem .85rem; border-radius: .9rem; white-space: normal; word-wrap: break-word; }
  .msg.student .bubble { background: #2563eb; color: #fff; border-bottom-right-radius: .2rem; }
  .msg.assistant .bubble { background: #f1f3f5; color: #1a1a1a; border-bottom-left-radius: .2rem; }
  .sources { font-size: .72rem; color: #9ca3af; margin-top: .25rem; max-width: 85%; }
  @media (prefers-color-scheme: dark) {
    body { background: #0f1115; color: #e5e7eb; }
    .conversation { background: #171a21; border-color: #262b36; }
    .conversation > header { border-color: #262b36; }
    .msg.assistant .bubble { background: #262b36; color: #e5e7eb; }
    .dim, .summary { color: #9ca3af; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <h1>Chat Records — ${escapeHtml(data.chatbotName)}</h1>
    <p class="summary">Exported ${escapeHtml(formatDateTime(data.exportedAt))} · ${plural(data.conversations.length, "conversation")}</p>
    ${truncatedNote}
    ${body}
  </div>
</body>
</html>`;
}

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
  lines.push("-".repeat(40));
  lines.push(
    "Records are exported for pedagogical and research use. Please handle",
  );
  lines.push("student data responsibly and in line with your institution's");
  lines.push("privacy policies.");
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Bundling
// ---------------------------------------------------------------------------

/**
 * Builds the file map for the bundle: one file per chosen format plus a
 * README that documents exactly those formats. Returns filename -> contents.
 */
export function buildExportFiles(
  data: ConversationsExport,
  formats: ExportFormat[],
): Record<string, string> {
  const files: Record<string, string> = {};
  if (formats.includes("html")) files[FORMAT_FILENAMES.html] = buildHtml(data);
  if (formats.includes("csv")) files[FORMAT_FILENAMES.csv] = buildCsv(data);
  if (formats.includes("text")) files[FORMAT_FILENAMES.text] = buildText(data);
  files["README.txt"] = buildInstructions(data, formats);
  return files;
}

/**
 * Builds the chosen files, zips them (fflate, in-memory), and triggers a
 * browser download of a single .zip. No-op outside the browser.
 */
export function downloadConversationsExport(
  data: ConversationsExport,
  formats: ExportFormat[],
): void {
  if (typeof document === "undefined") return;
  if (formats.length === 0) return;

  const files = buildExportFiles(data, formats);
  const zipInput: Record<string, Uint8Array> = {};
  for (const [name, contents] of Object.entries(files)) {
    zipInput[name] = strToU8(contents);
  }

  const zipped = zipSync(zipInput);
  // Copy into a fresh Uint8Array so the Blob gets a plain ArrayBuffer (not
  // fflate's possibly-pooled buffer view).
  const blob = new Blob([new Uint8Array(zipped)], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `chat-records-${slugify(data.chatbotName)}-${Date.now()}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
