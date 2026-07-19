import { strToU8, zipSync } from "fflate";
import {
  renderStudyToolsHtml,
  renderStudyToolsText,
  type ExportStudyTool,
} from "@/lib/study-tool-export";
import { TEACH_ANYTHING_LOGO_DATA_URI } from "@/lib/export-logo";

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

// Icon glyphs (lucide), inlined so the page needs no icon font/library.
const ICON = {
  message:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  clock:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
};

// A chat turn styled like the app's ChatMessage: student turns are a
// right-aligned tinted bubble; assistant turns show the Teach Anything avatar
// beside a bubble, with sources as badges below.
function renderMessageHtml(message: ExportMessage): string {
  if (message.role === "user") {
    const body = escapeHtml(message.content).replace(/\n/g, "<br>");
    return `<div class="row user">
      <div class="bubble bubble-user">${body}</div>
    </div>`;
  }

  const body = message.content.trim()
    ? `<div class="bubble bubble-assistant">${escapeHtml(message.content).replace(/\n/g, "<br>")}</div>`
    : "";
  const studyHtml = renderStudyToolsHtml(message.studyTools ?? []);
  const sources =
    message.sources.length > 0
      ? `<div class="sources"><span class="sources-label">${ICON.file}Sources:</span>${message.sources
          .map(
            (s) =>
              `<span class="badge" title="Relevance ${formatSimilarity(s.similarity)}">${escapeHtml(s.fileName)}</span>`,
          )
          .join("")}</div>`
      : "";
  return `<div class="row assistant">
      <div class="avatar" role="img" aria-label="Teach Anything"></div>
      <div class="asst-col">
        ${body}
        ${studyHtml}
        ${sources}
      </div>
    </div>`;
}

/** The transcript for one conversation, headed like the dashboard's chat viewer. */
function renderConversationDetail(conversation: ExportConversation): string {
  const messages = conversation.messages
    .map((message) => renderMessageHtml(message))
    .join("\n");
  const session = conversation.sessionId.slice(0, 8);
  return `<div class="chat-head">
      <div class="chat-title">Student Chat</div>
      <div class="chat-sub">Started ${escapeHtml(formatDateTime(conversation.createdAt))} · Session ${escapeHtml(session)}… · ${plural(conversation.messages.length, "message")}</div>
    </div>
    <div class="thread">
      ${messages || '<p class="muted">No messages in this conversation.</p>'}
    </div>`;
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
  var MSG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
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
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'conv-item' + (i === current ? ' active' : '');
      item.onclick = function(){ select(i); };
      item.style.setProperty('--i', shown);
      var p = document.createElement('div');
      p.className = 'conv-preview';
      p.textContent = c.preview;
      var m = document.createElement('div');
      m.className = 'conv-meta';
      var count = document.createElement('span');
      count.className = 'mi';
      count.innerHTML = MSG;
      count.appendChild(document.createTextNode(c.messages + (c.messages === 1 ? ' message' : ' messages')));
      var date = document.createElement('span');
      date.textContent = c.date;
      m.appendChild(count);
      m.appendChild(date);
      item.appendChild(p);
      item.appendChild(m);
      listEl.appendChild(item);
      shown++;
    });
    countEl.textContent = q ? (shown + ' of ' + DATA.length + ' chats') : (DATA.length + (DATA.length === 1 ? ' chat' : ' chats'));
    if (shown === 0){
      var e = document.createElement('div');
      e.className = 'list-empty';
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

  const convData = data.conversations.map((conversation) => ({
    preview: conversationPreview(conversation),
    date: formatDateTime(conversation.createdAt),
    messages: conversation.messages.length,
    search: conversationSearchText(conversation),
    html: renderConversationDetail(conversation),
  }));
  // Escape `<` so the JSON can't break out of the <script> element.
  const json = JSON.stringify(convData).replace(/</g, "\\u003c");

  const truncatedNote = data.truncated
    ? `<div class="notice">Showing the first ${data.maxConversations} conversations. This chatbot has more; export in smaller selections to capture the rest.</div>`
    : "";

  const emptyState =
    total === 0
      ? '<div class="empty-all">No chat records to export.</div>'
      : `<div class="layout">
      <aside class="index">
        <div class="index-head">
          <div class="search-wrap">
            ${ICON.search}
            <input id="search" class="search" type="search" placeholder="Search student chats…" autocomplete="off" spellcheck="false">
          </div>
          <div id="count" class="count"></div>
        </div>
        <div id="list" class="list"></div>
      </aside>
      <main class="reader">
        <button id="back" type="button" class="back">${ICON.back}All chats</button>
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
  /* Brand font (Teach Anything): Inter. Loaded from Google Fonts so the export
     matches the site online; falls back to the system UI font offline. */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  :root {
    color-scheme: light dark;
    --sans: Inter, system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    --logo: url("${TEACH_ANYTHING_LOGO_DATA_URI}");
    /* Teach Anything design tokens (oklch), light theme. */
    --paper: oklch(0.986 0.0019 84.56);
    --card: oklch(1 0 0);
    --panel: var(--card);
    --secondary: oklch(0.9843 0.0017 247.84);
    --sidebar-bg: oklch(0.9718 0.0056 157.15);
    --sidebar-fg: oklch(0.2458 0.0254 263.94);
    --ink: oklch(0.2158 0.0206 264);
    --muted: oklch(0.4411 0.0266 264.25);
    --muted-bg: oklch(0.9641 0.0037 84.56);
    --rule: oklch(0.9115 0.0059 84.57);
    --rule-strong: oklch(0.84 0.006 84.57);
    --accent: oklch(0.5248 0.1373 149.83);
    --accent-fg: oklch(1 0 0);
    --accent-soft: color-mix(in oklch, var(--accent) 9%, var(--card));
    --ok: oklch(0.5248 0.1373 149.83);
    --ok-soft: color-mix(in oklch, var(--accent) 14%, var(--paper));
    --bad: oklch(0.5216 0.1927 25.33);
    --bad-soft: color-mix(in oklch, oklch(0.6368 0.2078 25.33) 13%, var(--paper));
    --radius: 0.75rem;
    --shadow: 0 1px 2px oklch(0.2158 0.0206 264 / 0.06);
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    font-family: var(--sans);
    line-height: 1.6;
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    display: flex;
    flex-direction: column;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  .kicker {
    font-family: var(--sans);
    font-size: .68rem;
    letter-spacing: .18em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
  }
  .muted { color: var(--muted); font-family: var(--sans); font-size: .85rem; }

  /* Masthead */
  .masthead { padding: clamp(1.1rem, 3vw, 2rem) clamp(1.1rem, 4vw, 2.75rem) 1rem; border-bottom: 1px solid var(--rule-strong); }
  .masthead .kicker { margin-bottom: .5rem; }
  .masthead h1 {
    font-family: var(--sans);
    font-weight: 600;
    font-size: clamp(1.4rem, 3vw, 1.9rem);
    line-height: 1.15;
    letter-spacing: -.01em;
    margin: 0;
  }
  .masthead-meta { font-family: var(--sans); font-size: .82rem; color: var(--muted); margin-top: .5rem; }
  .masthead-meta b { color: var(--ink); font-weight: 600; }
  .notice { font-family: var(--sans); margin-top: .85rem; background: color-mix(in srgb, var(--accent) 7%, var(--panel)); border-left: 3px solid var(--accent); color: var(--ink); padding: .55rem .8rem; font-size: .82rem; border-radius: 0 .3rem .3rem 0; }
  .empty-all { padding: 4rem 1.5rem; text-align: center; font-family: var(--sans); color: var(--muted); }

  /* Layout */
  .layout { flex: 1; min-height: 0; display: flex; }

  /* Sidebar (Student Chats list) */
  .index { width: clamp(300px, 32vw, 400px); flex-shrink: 0; border-right: 1px solid var(--rule); display: flex; flex-direction: column; min-height: 0; background: var(--sidebar-bg); color: var(--sidebar-fg); }
  .index-head { padding: 1rem 1rem .5rem; }
  .search-wrap { position: relative; display: flex; align-items: center; }
  .search-wrap > svg { position: absolute; left: .7rem; width: 1rem; height: 1rem; color: var(--muted); pointer-events: none; }
  .search { width: 100%; height: 2.5rem; font-family: var(--sans); font-size: .9rem; color: var(--ink); background: var(--card); border: 1px solid var(--rule); border-radius: var(--radius); padding: 0 .8rem 0 2.1rem; outline: none; transition: border-color .15s ease, box-shadow .15s ease; }
  .search::placeholder { color: var(--muted); }
  .search:focus { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in oklch, var(--accent) 25%, transparent); }
  .count { font-family: var(--sans); font-size: .72rem; color: var(--muted); padding: .7rem .55rem .35rem; }

  .list { flex: 1; min-height: 0; overflow-y: auto; padding: 0 .5rem .8rem; }
  .conv-item {
    display: block; width: 100%; text-align: left; border: 0; background: none; cursor: pointer;
    color: inherit; font: inherit; padding: .6rem .7rem; border-radius: var(--radius);
    transition: background .12s ease;
    animation: rise .35s cubic-bezier(.2,.7,.2,1) both;
    animation-delay: calc(var(--i, 0) * 18ms);
  }
  .conv-item:hover { background: color-mix(in oklch, var(--muted-bg) 60%, transparent); }
  .conv-item.active { background: var(--accent-soft); }
  .conv-preview { font-family: var(--sans); font-size: .875rem; font-weight: 500; line-height: 1.4; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .conv-item.active .conv-preview { color: var(--accent); }
  .conv-meta { display: flex; align-items: center; gap: .8rem; margin-top: .3rem; font-family: var(--sans); font-size: .72rem; color: var(--muted); }
  .conv-meta .mi { display: inline-flex; align-items: center; gap: .3rem; }
  .conv-meta .mi svg { width: .82rem; height: .82rem; }
  .list-empty { padding: 1.5rem 1rem; font-family: var(--sans); font-size: .85rem; color: var(--muted); }

  /* Reading pane */
  .reader { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; background: var(--paper); }
  .back { display: none; align-items: center; gap: .25rem; margin: .8rem 0 0 clamp(.9rem, 4vw, 1.5rem); align-self: flex-start; background: var(--card); border: 1px solid var(--rule); border-radius: var(--radius); padding: .35rem .7rem .35rem .5rem; cursor: pointer; color: var(--ink); font-family: var(--sans); font-size: .82rem; font-weight: 500; }
  .back svg { width: 1rem; height: 1rem; }
  .detail { flex: 1; min-height: 0; overflow-y: auto; padding: 0 clamp(1rem, 4vw, 2.25rem) 3rem; }
  .chat-head { position: sticky; top: 0; z-index: 1; background: color-mix(in oklch, var(--paper) 88%, transparent); backdrop-filter: blur(6px); padding: 1.25rem 0 .9rem; margin-bottom: 1rem; border-bottom: 1px solid var(--rule); }
  .chat-title { font-family: var(--sans); font-weight: 600; font-size: 1.125rem; color: var(--ink); }
  .chat-sub { font-family: var(--sans); font-size: .8rem; color: var(--muted); margin-top: .15rem; }
  .thread { max-width: 48rem; }

  /* Chat bubbles (mirrors the app's ChatMessage) */
  .row { display: flex; margin-bottom: 1.1rem; }
  .row.user { justify-content: flex-end; }
  .row.assistant { gap: .75rem; align-items: flex-start; }
  .bubble { border-radius: var(--radius); padding: .7rem 1rem; font-size: .95rem; line-height: 1.6; box-shadow: var(--shadow); overflow-wrap: anywhere; }
  .bubble-user { max-width: 80%; background: color-mix(in oklch, var(--accent) 10%, transparent); border: 1px solid color-mix(in oklch, var(--accent) 22%, transparent); color: var(--ink); white-space: pre-wrap; }
  .bubble-assistant { background: var(--secondary); border: 1px solid color-mix(in oklch, var(--rule) 55%, transparent); color: var(--ink); }
  .avatar { flex-shrink: 0; width: 2.25rem; height: 2.25rem; border-radius: 999px; background-color: var(--card); background-image: var(--logo); background-size: 78%; background-position: center; background-repeat: no-repeat; box-shadow: 0 0 0 2px var(--paper), var(--shadow); filter: grayscale(1); }
  .asst-col { flex: 1; min-width: 0; }
  .asst-col > * + * { margin-top: .55rem; }
  .sources { display: flex; flex-wrap: wrap; align-items: center; gap: .45rem; }
  .sources-label { display: inline-flex; align-items: center; gap: .35rem; font-family: var(--sans); font-size: .74rem; font-weight: 500; color: var(--muted); }
  .sources-label svg { width: .9rem; height: .9rem; }
  .badge { font-family: var(--sans); font-size: .72rem; color: var(--muted); border: 1px solid var(--rule); border-radius: .4rem; padding: .1rem .45rem; }

  /* Study tools — a graded-insert treatment */
  .study-tool { border: 1px solid var(--rule-strong); border-radius: .5rem; padding: 1rem 1.1rem; margin-top: .7rem; background: color-mix(in srgb, var(--accent) 3%, var(--panel)); box-shadow: var(--shadow); }
  .study-tool .tool-label { font-family: var(--sans); font-weight: 700; font-size: .7rem; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); margin-bottom: .7rem; padding-bottom: .5rem; border-bottom: 1px solid var(--rule); }
  .study-tool .quiz-questions { margin: 0; padding: 0; list-style: none; counter-reset: q; }
  .study-tool .quiz-questions > li { counter-increment: q; margin-top: .9rem; }
  .study-tool .quiz-questions > li:first-child { margin-top: 0; }
  .study-tool .q { font-family: var(--sans); font-weight: 600; font-size: .95rem; }
  .study-tool .opts { list-style: none; padding: 0; margin: .4rem 0 .2rem; }
  .study-tool .opt { font-size: .92rem; padding: .18rem 0 .18rem 1.3rem; position: relative; color: var(--muted); }
  .study-tool .opt::before { content: "○"; position: absolute; left: 0; color: var(--rule-strong); }
  .study-tool .opt.correct { color: var(--ink); font-weight: 600; }
  .study-tool .opt.correct::before { content: "●"; color: var(--ok); }
  .study-tool .explanation { font-family: var(--sans); color: var(--muted); font-size: .78rem; margin-top: .3rem; }
  .study-tool .tag { font-family: var(--sans); font-size: .64rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; padding: .1rem .4rem; border-radius: .25rem; white-space: nowrap; }
  .study-tool .tag.ok { background: var(--ok-soft); color: var(--ok); }
  .study-tool .tag.bad { background: var(--bad-soft); color: var(--bad); }
  .study-tool .attempt { margin-top: .9rem; padding-top: .7rem; border-top: 1px solid var(--rule); }
  .study-tool .attempt-head { font-family: var(--sans); font-weight: 700; font-size: .7rem; letter-spacing: .08em; text-transform: uppercase; color: var(--ink); }
  .study-tool .attempt ul { list-style: none; margin: .4rem 0 0; padding: 0; }
  .study-tool .attempt li { font-size: .9rem; padding: .12rem 0; display: flex; gap: .5rem; align-items: baseline; justify-content: space-between; }
  .study-tool .tool-raw { font-family: var(--sans); white-space: pre-wrap; word-break: break-word; background: color-mix(in srgb, var(--ink) 5%, var(--panel)); padding: .5rem .6rem; border-radius: .35rem; font-size: .76rem; margin: .4rem 0 0; }

  @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .conv-item { animation: none; } }

  @media (max-width: 760px) {
    .index { width: 100%; border-right: 0; }
    .reader { display: none; }
    .back { display: inline-flex; }
    .bubble-user { max-width: 88%; }
    body.viewing-detail .index { display: none; }
    body.viewing-detail .reader { display: flex; }
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --paper: oklch(0.2158 0.0206 264);
      --card: oklch(0.2486 0.0195 264.13);
      --secondary: oklch(0.2879 0.0241 264.09);
      --sidebar-bg: oklch(0.2103 0.0059 285.88);
      --sidebar-fg: oklch(0.9676 0.0013 286.38);
      --ink: oklch(0.9843 0.0017 247.84);
      --muted: oklch(0.7106 0.0242 264.41);
      --muted-bg: oklch(0.2879 0.0241 264.09);
      --rule: oklch(0.2879 0.0241 264.09);
      --rule-strong: oklch(0.36 0.02 264);
      --accent: oklch(0.7233 0.1939 149.39);
      --accent-fg: oklch(0.2158 0.0206 264);
      --accent-soft: color-mix(in oklch, var(--accent) 16%, var(--card));
      --ok: oklch(0.7233 0.1939 149.39);
      --ok-soft: color-mix(in oklch, var(--accent) 20%, var(--paper));
      --bad: oklch(0.72 0.14 25.33);
      --bad-soft: color-mix(in oklch, oklch(0.6368 0.2078 25.33) 22%, var(--paper));
      --shadow: none;
    }
  }
</style>
</head>
<body>
  <header class="masthead">
    <div class="kicker">Teach Anything · Chat Records</div>
    <h1>${escapeHtml(data.chatbotName)}</h1>
    <div class="masthead-meta">Exported <b>${escapeHtml(formatDateTime(data.exportedAt))}</b> · <b>${plural(total, "conversation")}</b></div>
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
