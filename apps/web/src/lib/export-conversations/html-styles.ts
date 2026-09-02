import { TEACH_ANYTHING_LOGO_DATA_URI } from "@/lib/export-logo";

/**
 * The <style> contents of the exported transcript page. Kept byte-identical
 * to the inline version it was extracted from; `buildHtml` interpolates it
 * between the style tags.
 */
export const EXPORT_HTML_STYLES = `
  /* Brand font (Teach Anything): Inter. Loaded from Google Fonts so the export
     matches the site online; falls back to the system UI font offline. */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  :root {
    color-scheme: light;
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
`;
