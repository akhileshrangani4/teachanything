import {
  renderStudyToolsHtml,
  renderStudyToolsText,
} from "@/lib/study-tool-export";
import type {
  ExportConversation,
  ExportMessage,
  ConversationsExport,
} from "./types";
import {
  escapeHtml,
  formatDateTime,
  formatSimilarity,
  plural,
} from "./format-helpers";
import { EXPORT_HTML_STYLES } from "./html-styles";

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
<style>${EXPORT_HTML_STYLES}</style>
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
