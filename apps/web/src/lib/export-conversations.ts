import { strToU8, zipSync } from "fflate";
import {
  renderStudyToolsHtml,
  renderStudyToolsText,
  type ExportStudyTool,
} from "@/lib/study-tool-export";

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

export type { ExportStudyTool } from "@/lib/study-tool-export";

export interface ExportMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string | Date;
  sources: ExportSource[];
  // Study-tool widgets shown in this (assistant) turn, with student attempts.
  // Optional so older payloads without study tools stay valid.
  studyTools?: ExportStudyTool[];
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

// ---------------------------------------------------------------------------
// HTML (visual transcript)
// ---------------------------------------------------------------------------

function renderMessageHtml(message: ExportMessage, turn: number): string {
  const side = message.role === "user" ? "student" : "assistant";
  // Quiz-only turns have no prose; render just the study-tool block, no bubble.
  const bubble = message.content.trim()
    ? `<div class="bubble">${escapeHtml(message.content).replace(/\n/g, "<br>")}</div>`
    : "";
  const studyHtml =
    message.role === "assistant"
      ? renderStudyToolsHtml(message.studyTools ?? [])
      : "";
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
      ${bubble}
      ${studyHtml}
      ${sources}
    </div>`;
}

/** The transcript body for one conversation (header + turns), for the detail pane. */
function renderConversationDetail(
  conversation: ExportConversation,
  index: number,
  total: number,
): string {
  const messages = conversation.messages
    .map((message, messageIndex) =>
      renderMessageHtml(message, messageIndex + 1),
    )
    .join("\n");
  return `<div class="conv-detail-header">
      <h2>Conversation ${index + 1} <span class="dim">of ${total}</span></h2>
      <div class="dim">Session ${escapeHtml(conversation.sessionId)} · Started ${escapeHtml(formatDateTime(conversation.createdAt))} · ${plural(conversation.messages.length, "message")}</div>
    </div>
    ${messages || '<p class="dim">No messages in this conversation.</p>'}`;
}

/** Short list-item preview: the first student question, else a sensible label. */
function conversationPreview(conversation: ExportConversation): string {
  const firstUser = conversation.messages.find(
    (m) => m.role === "user" && m.content.trim(),
  );
  const fallback = conversation.messages.find((m) => m.content.trim());
  const text = (firstUser ?? fallback)?.content.trim() ?? "";
  if (!text) {
    const hasStudyTool = conversation.messages.some(
      (m) => (m.studyTools?.length ?? 0) > 0,
    );
    return hasStudyTool ? "Study activity" : "No messages";
  }
  return text.length > 100 ? `${text.slice(0, 100).trimEnd()}…` : text;
}

/** Lowercased searchable text for a conversation (messages + study tools). */
function conversationSearchText(conversation: ExportConversation): string {
  return conversation.messages
    .map((m) => `${m.content} ${renderStudyToolsText(m.studyTools ?? [])}`)
    .join(" ")
    .toLowerCase();
}

// Vanilla client script for the exported page: renders the conversation list,
// filters it on search, and swaps the detail pane on selection. No template
// literals / `${}` here so it survives the outer TS template literal verbatim.
const EXPORT_APP_JS = `(function(){
  var DATA = JSON.parse(document.getElementById('export-data').textContent);
  var listEl = document.getElementById('list');
  var detailEl = document.getElementById('detail');
  var searchEl = document.getElementById('search');
  var countEl = document.getElementById('count');
  var backEl = document.getElementById('back');
  var current = -1;
  function renderList(){
    var q = (searchEl.value || '').trim().toLowerCase();
    listEl.innerHTML = '';
    var shown = 0;
    DATA.forEach(function(c, i){
      if (q && c.search.indexOf(q) === -1) return;
      shown++;
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'conv-item' + (i === current ? ' active' : '');
      item.onclick = function(){ select(i); };
      var p = document.createElement('div');
      p.className = 'conv-preview';
      p.textContent = c.preview;
      var m = document.createElement('div');
      m.className = 'conv-meta dim';
      m.textContent = c.date + ' \\u00b7 ' + c.messages + (c.messages === 1 ? ' message' : ' messages');
      item.appendChild(p);
      item.appendChild(m);
      listEl.appendChild(item);
    });
    countEl.textContent = q ? (shown + ' of ' + DATA.length + ' chats') : (DATA.length + ' chats');
    if (shown === 0){
      var e = document.createElement('div');
      e.className = 'list-empty dim';
      e.textContent = 'No matching chats.';
      listEl.appendChild(e);
    }
  }
  function select(i){
    current = i;
    detailEl.innerHTML = DATA[i].html;
    detailEl.scrollTop = 0;
    document.body.classList.add('viewing-detail');
    renderList();
  }
  searchEl.addEventListener('input', renderList);
  if (backEl) backEl.addEventListener('click', function(){
    document.body.classList.remove('viewing-detail');
  });
  renderList();
  if (DATA.length) select(0);
})();`;

export function buildHtml(data: ConversationsExport): string {
  const title = `Chat Records — ${escapeHtml(data.chatbotName)}`;
  const total = data.conversations.length;

  const convData = data.conversations.map((conversation, index) => ({
    preview: conversationPreview(conversation),
    date: formatDateTime(conversation.createdAt),
    messages: conversation.messages.length,
    search: conversationSearchText(conversation),
    html: renderConversationDetail(conversation, index, total),
  }));
  // Escape `<` so the JSON can't break out of the <script> element.
  const json = JSON.stringify(convData).replace(/</g, "\\u003c");

  const truncatedNote = data.truncated
    ? `<div class="notice">Showing the first ${data.maxConversations} conversations. This chatbot has more; export in smaller selections to capture the rest.</div>`
    : "";

  const emptyState =
    total === 0
      ? '<div class="empty-all dim">No chat records to export.</div>'
      : `<div class="layout">
      <aside class="sidebar">
        <div class="search-wrap">
          <input id="search" type="search" placeholder="Search chats…" autocomplete="off" spellcheck="false">
        </div>
        <div id="count" class="count dim"></div>
        <div id="list" class="list"></div>
      </aside>
      <main class="detail-pane">
        <button id="back" type="button" class="back">← All chats</button>
        <div id="detail" class="detail"></div>
      </main>
    </div>
    <script id="export-data" type="application/json">${json}</script>
    <script>${EXPORT_APP_JS}</script>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; --bg:#f6f7f9; --panel:#fff; --border:#e5e7eb; --text:#1a1a1a; --dim:#6b7280; --accent:#2563eb; --hover:#f1f3f5; }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; margin: 0; background: var(--bg); color: var(--text); display: flex; flex-direction: column; }
  h1 { font-size: 1.15rem; margin: 0; }
  h2 { font-size: 1.05rem; margin: 0; }
  .dim { color: var(--dim); font-weight: 400; font-size: .85rem; }
  .app-header { padding: .9rem 1.25rem; border-bottom: 1px solid var(--border); background: var(--panel); }
  .notice { margin-top: .6rem; background: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: .5rem .75rem; border-radius: .5rem; font-size: .85rem; }
  .empty-all { padding: 3rem 1.25rem; text-align: center; }
  .layout { flex: 1; min-height: 0; display: flex; }
  .sidebar { width: 340px; flex-shrink: 0; border-right: 1px solid var(--border); background: var(--panel); display: flex; flex-direction: column; min-height: 0; }
  .search-wrap { padding: .75rem; border-bottom: 1px solid var(--border); }
  #search { width: 100%; padding: .5rem .7rem; border: 1px solid var(--border); border-radius: .5rem; font-size: .9rem; background: var(--bg); color: var(--text); }
  .count { padding: .5rem .9rem 0; }
  .list { flex: 1; min-height: 0; overflow-y: auto; padding: .4rem; }
  .conv-item { display: block; width: 100%; text-align: left; border: none; background: none; padding: .6rem .7rem; border-radius: .5rem; cursor: pointer; color: inherit; font: inherit; }
  .conv-item:hover { background: var(--hover); }
  .conv-item.active { background: color-mix(in srgb, var(--accent) 12%, transparent); }
  .conv-preview { font-size: .9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .conv-meta { margin-top: .15rem; }
  .list-empty { padding: 1rem .9rem; }
  .detail-pane { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
  .back { display: none; margin: .6rem .6rem 0; align-self: flex-start; background: none; border: 1px solid var(--border); border-radius: .5rem; padding: .3rem .6rem; cursor: pointer; color: inherit; font: inherit; font-size: .85rem; }
  .detail { flex: 1; min-height: 0; overflow-y: auto; padding: 1.25rem 1.5rem 3rem; max-width: 900px; }
  .conv-detail-header { margin-bottom: 1rem; padding-bottom: .75rem; border-bottom: 1px solid var(--border); }
  .msg { margin: .75rem 0; display: flex; flex-direction: column; }
  .msg.student { align-items: flex-end; }
  .msg.assistant { align-items: flex-start; }
  .msg .meta { font-size: .75rem; color: #9ca3af; margin-bottom: .2rem; }
  .bubble { max-width: 85%; padding: .6rem .85rem; border-radius: .9rem; white-space: normal; word-wrap: break-word; }
  .msg.student .bubble { background: var(--accent); color: #fff; border-bottom-right-radius: .2rem; }
  .msg.assistant .bubble { background: var(--hover); color: var(--text); border-bottom-left-radius: .2rem; }
  .sources { font-size: .72rem; color: #9ca3af; margin-top: .25rem; max-width: 85%; }
  .study-tool { width: 100%; box-sizing: border-box; background: #fbfbfd; border: 1px solid var(--border); border-radius: .6rem; padding: .75rem .9rem; margin-top: .4rem; font-size: .9rem; }
  .study-tool .tool-label { font-weight: 600; margin-bottom: .35rem; }
  .study-tool .quiz-questions { margin: 0; padding-left: 1.2rem; }
  .study-tool .q { font-weight: 500; margin-top: .5rem; }
  .study-tool .opts { list-style: none; padding: 0; margin: .25rem 0; }
  .study-tool .opt { padding: .1rem 0; }
  .study-tool .opt.correct { font-weight: 600; }
  .study-tool .explanation { color: var(--dim); font-size: .8rem; margin-top: .2rem; }
  .study-tool .tag { font-size: .7rem; padding: .05rem .35rem; border-radius: .3rem; white-space: nowrap; }
  .study-tool .tag.ok { background: #dcfce7; color: #166534; }
  .study-tool .tag.bad { background: #fee2e2; color: #991b1b; }
  .study-tool .attempt { margin-top: .6rem; border-top: 1px dashed var(--border); padding-top: .45rem; }
  .study-tool .attempt-head { font-weight: 500; }
  .study-tool .attempt ul { margin: .2rem 0; padding-left: 1.2rem; }
  .study-tool .tool-raw { white-space: pre-wrap; word-break: break-word; background: var(--hover); padding: .4rem; border-radius: .3rem; font-size: .75rem; }
  @media (max-width: 720px) {
    .sidebar { width: 100%; }
    .detail-pane { display: none; }
    .back { display: block; }
    body.viewing-detail .sidebar { display: none; }
    body.viewing-detail .detail-pane { display: flex; }
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0f1115; --panel:#171a21; --border:#262b36; --text:#e5e7eb; --dim:#9ca3af; --hover:#262b36; }
    .study-tool { background: #12151b; }
    .study-tool .tool-raw { background: #0f1115; }
    .study-tool .tag.ok { background: #14532d; color: #bbf7d0; }
    .study-tool .tag.bad { background: #7f1d1d; color: #fecaca; }
    .notice { background: #3b2f0b; border-color: #665417; color: #fde68a; }
  }
</style>
</head>
<body>
  <header class="app-header">
    <h1>${escapeHtml(data.chatbotName)}</h1>
    <div class="dim">Chat records · Exported ${escapeHtml(formatDateTime(data.exportedAt))} · ${plural(total, "conversation")}</div>
    ${truncatedNote}
  </header>
  ${emptyState}
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
