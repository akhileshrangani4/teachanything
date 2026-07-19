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

// A turn in the transcript, laid out like a printed interview: the speaker
// sits in a left rail (small-caps) and their words run in the reading column,
// rather than as chat bubbles.
function renderMessageHtml(message: ExportMessage): string {
  const side = message.role === "user" ? "student" : "tutor";
  const say = message.content.trim()
    ? `<p class="say">${escapeHtml(message.content).replace(/\n/g, "<br>")}</p>`
    : "";
  const studyHtml =
    message.role === "assistant"
      ? renderStudyToolsHtml(message.studyTools ?? [])
      : "";
  const sources =
    message.role === "assistant" && message.sources.length > 0
      ? `<p class="sources">Sources — ${message.sources
          .map(
            (s) =>
              `${escapeHtml(s.fileName)} (${formatSimilarity(s.similarity)})`,
          )
          .join("; ")}</p>`
      : "";
  return `<div class="turn turn-${side}">
      <div class="rail">
        <span class="speaker">${roleLabel(message.role)}</span>
        <span class="turn-time">${escapeHtml(formatDateTime(message.createdAt))}</span>
      </div>
      <div class="turn-body">
        ${say}
        ${studyHtml}
        ${sources}
      </div>
    </div>`;
}

/** The transcript body for one conversation (header + turns), for the detail pane. */
function renderConversationDetail(
  conversation: ExportConversation,
  index: number,
  total: number,
): string {
  const messages = conversation.messages
    .map((message) => renderMessageHtml(message))
    .join("\n");
  const headline = conversationPreview(conversation);
  return `<article class="conv">
    <header class="conv-head">
      <div class="kicker">Conversation ${index + 1} of ${total}</div>
      <h2 class="conv-headline">${escapeHtml(headline)}</h2>
      <div class="conv-sub">Session ${escapeHtml(conversation.sessionId)} · ${escapeHtml(formatDateTime(conversation.createdAt))} · ${plural(conversation.messages.length, "message")}</div>
    </header>
    ${messages || '<p class="muted">No messages in this conversation.</p>'}
  </article>`;
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
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'conv-item' + (i === current ? ' active' : '');
      item.onclick = function(){ select(i); };
      item.style.setProperty('--i', shown);
      var num = document.createElement('span');
      num.className = 'conv-num';
      num.textContent = (i + 1 < 10 ? '0' : '') + (i + 1);
      var body = document.createElement('span');
      body.className = 'conv-item-body';
      var p = document.createElement('span');
      p.className = 'conv-preview';
      p.textContent = c.preview;
      var m = document.createElement('span');
      m.className = 'conv-meta';
      m.textContent = c.date + ' \\u00b7 ' + c.messages + (c.messages === 1 ? ' message' : ' messages');
      body.appendChild(p);
      body.appendChild(m);
      item.appendChild(num);
      item.appendChild(body);
      listEl.appendChild(item);
      shown++;
    });
    countEl.textContent = q ? (shown + ' of ' + DATA.length + ' chats') : (DATA.length + (DATA.length === 1 ? ' chat' : ' chats'));
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
      ? '<div class="empty-all">No chat records to export.</div>'
      : `<div class="layout">
      <aside class="index">
        <div class="index-head">
          <input id="search" class="search" type="search" placeholder="Search conversations…" autocomplete="off" spellcheck="false">
        </div>
        <div id="count" class="count"></div>
        <div id="list" class="list"></div>
      </aside>
      <main class="reader">
        <button id="back" type="button" class="back">← All conversations</button>
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
  :root {
    color-scheme: light dark;
    --serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, Cambria, serif;
    --sans: "Avenir Next", Avenir, "Segoe UI", "Helvetica Neue", Helvetica, sans-serif;
    --paper: #f7f3ea;
    --panel: #fbf8f1;
    --ink: #26221b;
    --muted: #6f6656;
    --rule: #e4dcca;
    --rule-strong: #d3c8b0;
    --accent: #3c4f7a;
    --accent-soft: color-mix(in srgb, var(--accent) 10%, var(--panel));
    --ok: #4a6a44;
    --ok-soft: #e6ede0;
    --bad: #8a3d3a;
    --bad-soft: #f1e2df;
    --shadow: 0 1px 2px rgba(40, 34, 22, .05);
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    font-family: var(--serif);
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
  .masthead { padding: clamp(1.1rem, 3vw, 2rem) clamp(1.1rem, 4vw, 2.75rem) 1rem; border-bottom: 2px solid var(--ink); }
  .masthead .kicker { margin-bottom: .5rem; }
  .masthead h1 {
    font-family: var(--serif);
    font-weight: 600;
    font-size: clamp(1.6rem, 4.5vw, 2.5rem);
    line-height: 1.08;
    letter-spacing: -.01em;
    margin: 0;
  }
  .masthead-meta { font-family: var(--sans); font-size: .82rem; color: var(--muted); margin-top: .5rem; }
  .masthead-meta b { color: var(--ink); font-weight: 600; }
  .notice { font-family: var(--sans); margin-top: .85rem; background: color-mix(in srgb, var(--accent) 7%, var(--panel)); border-left: 3px solid var(--accent); color: var(--ink); padding: .55rem .8rem; font-size: .82rem; border-radius: 0 .3rem .3rem 0; }
  .empty-all { padding: 4rem 1.5rem; text-align: center; font-family: var(--sans); color: var(--muted); }

  /* Layout */
  .layout { flex: 1; min-height: 0; display: flex; }
  .index { width: clamp(280px, 30vw, 380px); flex-shrink: 0; border-right: 1px solid var(--rule-strong); display: flex; flex-direction: column; min-height: 0; background: var(--panel); }
  .index-head { padding: 1rem 1.15rem .5rem; }
  .search { width: 100%; font-family: var(--sans); font-size: .9rem; color: var(--ink); background: transparent; border: none; border-bottom: 1.5px solid var(--rule-strong); padding: .35rem .1rem; outline: none; transition: border-color .18s ease; }
  .search::placeholder { color: var(--muted); }
  .search:focus { border-color: var(--accent); }
  .count { font-family: var(--sans); font-size: .68rem; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); padding: .7rem 1.2rem .3rem; }

  /* Index list */
  .list { flex: 1; min-height: 0; overflow-y: auto; padding: 0 .55rem .8rem; }
  .conv-item {
    display: grid; grid-template-columns: 1.9rem 1fr; gap: .7rem; align-items: baseline;
    width: 100%; text-align: left; border: 0; background: none; cursor: pointer;
    color: inherit; font: inherit; padding: .7rem .6rem; border-radius: .4rem;
    border-bottom: 1px solid var(--rule);
    transition: background .15s ease;
    animation: rise .4s cubic-bezier(.2,.7,.2,1) both;
    animation-delay: calc(var(--i, 0) * 22ms);
  }
  .conv-item:last-child { border-bottom: 0; }
  .conv-item:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
  .conv-item.active { background: var(--accent-soft); box-shadow: inset 2px 0 0 var(--accent); }
  .conv-num { font-family: var(--sans); font-size: .72rem; font-weight: 600; color: var(--muted); font-variant-numeric: tabular-nums; padding-top: .15rem; }
  .conv-item.active .conv-num { color: var(--accent); }
  .conv-item-body { min-width: 0; }
  .conv-preview { display: block; font-family: var(--serif); font-size: .96rem; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .conv-meta { display: block; font-family: var(--sans); font-size: .72rem; color: var(--muted); margin-top: .25rem; }
  .list-empty { padding: 1.5rem 1.2rem; font-family: var(--sans); font-size: .85rem; color: var(--muted); }

  /* Reading pane */
  .reader { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
  .back { display: none; margin: .9rem 0 0 clamp(1rem, 4vw, 2.5rem); align-self: flex-start; background: none; border: 0; border-bottom: 1px solid var(--rule-strong); padding: .1rem 0; cursor: pointer; color: var(--muted); font-family: var(--sans); font-size: .78rem; letter-spacing: .04em; }
  .detail { flex: 1; min-height: 0; overflow-y: auto; padding: clamp(1.3rem, 4vw, 3rem) clamp(1.1rem, 4vw, 2.5rem) 4rem; }
  .conv { max-width: 46rem; }
  .conv-head { margin-bottom: 1.75rem; }
  .conv-head .kicker { margin-bottom: .5rem; }
  .conv-headline { font-family: var(--serif); font-weight: 600; font-size: clamp(1.3rem, 3vw, 1.7rem); line-height: 1.15; margin: 0; letter-spacing: -.005em; }
  .conv-sub { font-family: var(--sans); font-size: .76rem; color: var(--muted); margin-top: .5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--rule); }

  /* Transcript turns (interview layout) */
  .turn { display: grid; grid-template-columns: 6.5rem 1fr; gap: 1.4rem; padding: 1rem 0; border-bottom: 1px solid var(--rule); }
  .turn:last-child { border-bottom: 0; }
  .rail { display: flex; flex-direction: column; gap: .15rem; padding-top: .1rem; }
  .speaker { font-family: var(--sans); font-size: .7rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .turn-student .speaker { color: var(--accent); }
  .turn-tutor .speaker { color: var(--muted); }
  .turn-time { font-family: var(--sans); font-size: .66rem; color: var(--muted); }
  .turn-body { min-width: 0; }
  .say { margin: 0; font-size: 1.02rem; line-height: 1.65; overflow-wrap: anywhere; }
  .say + .study-tool, .say + .sources { margin-top: .7rem; }
  .sources { margin: .6rem 0 0; font-family: var(--sans); font-size: .74rem; color: var(--muted); font-style: normal; }

  /* Study tools — a graded-insert treatment */
  .study-tool { border: 1px solid var(--rule-strong); border-radius: .5rem; padding: 1rem 1.1rem; margin-top: .7rem; background: color-mix(in srgb, var(--accent) 3%, var(--panel)); box-shadow: var(--shadow); }
  .study-tool .tool-label { font-family: var(--sans); font-weight: 700; font-size: .7rem; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); margin-bottom: .7rem; padding-bottom: .5rem; border-bottom: 1px solid var(--rule); }
  .study-tool .quiz-questions { margin: 0; padding: 0; list-style: none; counter-reset: q; }
  .study-tool .quiz-questions > li { counter-increment: q; margin-top: .9rem; }
  .study-tool .quiz-questions > li:first-child { margin-top: 0; }
  .study-tool .q { font-family: var(--serif); font-weight: 600; font-size: .98rem; }
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
    .back { display: block; }
    .turn { grid-template-columns: 1fr; gap: .3rem; }
    .rail { flex-direction: row; align-items: baseline; gap: .6rem; }
    body.viewing-detail .index { display: none; }
    body.viewing-detail .reader { display: flex; }
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --paper: #16130d; --panel: #1d1912; --ink: #ece5d6; --muted: #a99e88;
      --rule: #2e281d; --rule-strong: #3d3627; --accent: #a9b8dc; --accent-soft: color-mix(in srgb, var(--accent) 14%, var(--panel));
      --ok: #9ab98a; --ok-soft: #23301d; --bad: #d19b98; --bad-soft: #33211f; --shadow: none;
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
