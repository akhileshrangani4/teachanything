> Exported from Obvious Blueprint `art_DZ3EOoSd` ("Trustworthy answers + two security fixes", last edited 2026-11-13 23:20:41.763 UTC) on 2026-11-17, converted from its HTML. Callouts and notes are labelled blockquotes; the flow diagram is rendered as text. Status: approved spec; see README.md for what was built.

*Spec · Teach Anything · new track*

# Trustworthy answers, plus two security fixes

Measure answer grounding, then make it better: an offline evaluation harness, tighter retrieval, and citations that show what each answer actually used. Separately, two small hardening fixes: login and registration rate limits that can't be bypassed by spoofing the IP header, and security headers that stop admin pages being framed while keeping embeds working.

## What to approve

Teach Anything's value is answers grounded in a professor's materials. Today nothing measures that grounding. Each turn injects context sized to the model's context window rather than by relevance. With default settings, students see no sources. The prompts tell the model both "never cite" and "cite file and page".

**The direction:** build the measurement first (D1). Change retrieval only behind it (D2), so the fix cannot quietly reintroduce #271, where the bot confidently says "not in your materials" when the answer is there. Then switch from "show everything retrieved" to "show what the answer cited" (D3, D4). Ship the two security fixes (S1, S2) as independent small PRs that do not wait on the AI work.

> **Approve or challenge**
>
> - The six deliverables below and their acceptance targets.
> - Delivery: D1–D4 on a release branch `release/trustworthy-answers`; S1 and S2 as independent PRs to `main`.
> - Students get no file access: they see file name, page and a short excerpt only. Page links open the file for the professor (owner) only.
> - Reranking is model-based, uses the existing OpenRouter client, is off by default, and is enabled only if the eval shows it pays for itself.

### Out of scope

- Everything owned by the Issue Triage track: file pipeline/OCR/vision (#126, #128, #129, #462, #463, #550, #561), ratings (#559), dashboard i18n (#540, #560), registration emails (#136), turn lock (#465), account deletion (#464), #480, Common Questions (#315), drift check (#515), Jest ESM (#399), quiz-JSON recovery (#398).
- Tutoring modes, token metering and budgets, the proxy's IP-only public-chat bucket, observability, CI Postgres. Research ranked these; they are not chosen for this track.
- Running the eval in CI. CI has no Postgres, and adding one is a workflow change that needs maintainer sign-off under AGENTS.md §15.
- Changing the `showSources` default. See open questions.

## Current state: what I read

Read on `main@7fee02e`, plus the three research docs in this project: `art_0xSIXg3p` (AI core), `art_ktM9QU8j` (platform health) and `art_GFoVZKhr` (product).

| Read | Learned | Changed the design |
| --- | --- | --- |
| `packages/ai/src/token-budget.ts` (`CHUNK_SHARE`, `AVG_CHUNK_TOKENS`, `MAX_CONTEXT_CHUNKS`) | 60% of the input budget goes to chunks. `AVG_CHUNK_TOKENS = 625` is documented as "2500 chars / 4", but `rag-service.ts:28` chunks at 1000 chars. The only hard cap is 256 chunks. | The context count is set by window size, not relevance. D2 replaces it with a top-k plus a relevance floor, and fixes the constant. |
| `apps/web/src/server/chat/stream-chat.ts:101-128`, `turn-context.ts:45-60,116-125` | Pass 1 calls `calculateChunkLimit` before retrieval and passes it as `chunkLimit`. Pass 2 runs with `availableChunks: []`, so injected context is never trimmed. Both the agentic and fallback paths get it. | D2 changes the limit at the source (`buildRAGContext`), not in the budget pass. |
| `apps/web/src/server/hybrid-search.ts:110-170` | Vector (HNSW) and full-text retrieval, fused by RRF. Overfetch is `min(limit*2, 60)`. There is no similarity threshold. pg_trgm was removed on purpose (#516). | The relevance floor applies to vector similarity on the fused set. No trigram comes back. |
| `apps/web/src/server/chat/prompt-assembly.ts` `buildGroundingRule` | "Do NOT put inline citations, source tags, page numbers… the app shows the user the sources separately." | D3 rewrites this rule. |
| `apps/web/src/server/retrieval-tools.ts` `done` tool | "Cite the file and page for each claim." That contradicts the grounding rule. `search_documents` returns `pageNumber`. | D3 makes one citation protocol across both. |
| `apps/web/src/server/format-passage.ts` | Passages are headed `[Source: name, Part N]`, with no page number and no reference id. | D3 adds numbered refs and pages. |
| `turn-endings.ts` `recordSources`, `lib/chat/helpers.ts` `mergeSources` | Sources shown are all injected sources plus every tool hit, not what the answer used. Tool hits get `similarity: 0`. | D3 persists `citations` separately and keeps `sources` for back-compat. |
| `packages/db/src/schema.ts:185,346-355,276-292` | `showSources` defaults to false. Message `metadata.sources` is `{fileName, chunkIndex, similarity, pageNumber?}`. Chunks carry `metadata.pageNumber`. | The citation shape reuses these fields. JSONB needs no migration. |
| `lib/message-sources.ts`, `components/chat/messages/source-list.tsx`, `components/ui/source-badge.tsx`, `ChatMessage.tsx:92` | Sources are grouped by file and sorted by similarity. Badges are not links. `react-markdown` renders the text. There is no Storybook (0 `.stories.` files). | D4 adds presentational components verified by component tests, not stories. |
| `app/api/files/[fileId]/download/route.ts` | Requires an owner session on every request and serves PDFs inline. | Page links are owner-only (`#page=N` on the inline PDF). Students get excerpts, not files. |
| `stream-chat.ts` header comment | "Retrieval tool RESULTS never reach the browser (privacy)." | D3 sends only capped excerpts of *cited* passages, and only when the professor has turned on `showSources`. |
| `app/api/auth/[...all]/route.ts:18-21`, `lib/get-client-ip.ts` | Login and registration limiters key on the *leftmost* `X-Forwarded-For` hop. The repo's own helper documents that hop as attacker-controlled; the helper uses `x-real-ip`, then the rightmost hop. `proxy.ts` and `api/chat/shared` already use the helper. | S1 is a narrow swap to the helper. |
| `apps/web/next.config.js`, `proxy.ts` matcher, `app/embed/[shareToken]/{window,button}`, `embed-code-generators.ts` | No `headers()`. Only the download route sets `X-Frame-Options`. The embed snippet iframes `/embed/*` on third-party sites. | S2 adds an embed-aware header matrix. |
| `.github/workflows/test.yml`, `AGENTS.md` §15 | CI runs `npm run test` with no Postgres. Adding or changing dependencies or tool config needs explicit sign-off. | The D1 runner is local/on-demand, gated on `TEST_DATABASE_URL` like the existing DB suites. Its pure metric code runs in CI. It adds no dependencies. |

> **Note**
>
> Inference, not measured: on the default Llama 3.3 70B (131k window, 2000 max tokens) the code constants give `calculateChunkLimit` ≈ 98 chunks, about 20–25k injected tokens re-sent on each agentic step (arithmetic in `art_0xSIXg3p` candidate 2). D1's baseline run replaces this estimate with a measured number.

## How a turn changes

**Figure: Chat turn retrieval and citation flow after this spec**

The latest message, plus a rewrite when there is history, goes to hybrid search. A relevance floor and an optional reranker select a top-k of numbered passages. The model answers with bracketed refs, and the server maps the refs to citations that the UI renders as footnotes.

```text
[message / (+ rewrite, D2)] -> [hybridSearch / vector + FTS, RRF] -> [floor + top-k / (+ rerank flag, D2)] -> [model answer / with [n] refs] -> [citations → / footnotes (D3/D4)]
  (dashed box, linked to 'floor + top-k' and 'model answer'): [D1 eval harness measures both / recall@k · tokens · citation validity]
```

*Retrieval gets smaller and relevance-gated. Answers carry numbered refs that the server resolves to citations. The eval harness measures both ends.*

## What we should build

As decided above: measurement first, then precision, then citations. Two independent security fixes ride alongside.

### D1 — Retrieval and answer evaluation harness

An offline, repeatable measure of retrieval quality and answer grounding, so every later retrieval or prompt change is judged by numbers rather than anecdotes.

- **Corpus.** 2–4 permissively licensed course documents (for example, openly licensed textbook chapters). License and attribution are recorded in `apps/web/eval/fixtures/README.md`. At least one is a multi-page PDF, so page numbers are exercised. The total is at most 300 chunks. Documents are chunked with the real `RAGService` chunker so fixtures match production chunking.
- **Golden set** (`golden.json`), at least 50 cases:
  - at least 30 answerable questions, each with expected passages identified by `{fileName, pageNumber, mustContain}`. The text anchor keeps cases valid if chunk boundaries move.
  - at least 8 follow-ups that only make sense with the previous turn.
  - at least 6 exact-detail questions in the style of #271.
  - at least 6 off-topic questions whose expected passages are an empty list.
- **Embedding cache.** Chunk and query embeddings are stored as base64 float32, keyed by a hash of the text, in a generated fixture committed in its own commit. Retrieval mode needs only Postgres with pgvector. A cache miss with no embedding credentials fails with a message naming the missing text hash.
- **Runner** `npm run eval:retrieval -w apps/web`, gated on `TEST_DATABASE_URL`. It migrates and loads the fixtures into a scratch schema and calls the real `buildRAGContext`/`hybridSearch` per case. It writes `eval/reports/<timestamp>.json` and a markdown summary with these metrics:
  - recall@injected: an expected passage is in the injected context
  - MRR
  - median and p95 injected tokens
  - off-topic false-injection rate
  - p50/p95 retrieval latency

  `--compare eval/baseline.json` exits 1 on a regression beyond the tolerances below.
- **Answer mode** `npm run eval:answers` is opt-in and needs the OpenRouter key; it never runs in CI. It runs real turns for the chatbot's model and scores:
  - citation validity: every cited ref was provided
  - cited-source precision against the golden passages
  - the denial rate on answerable questions, which catches #271 regressions
- Metric and scoring functions are pure modules in `apps/web/src/server/eval/`, so they are unit-tested in CI.

**Golden case and report shape (representative)**

```typescript
type GoldenCase = {
  id: string;
  kind: "answerable" | "followup" | "exact" | "offtopic";
  history?: { role: "user" | "assistant"; content: string }[]; // follow-ups
  question: string;
  expected: { fileName: string; pageNumber?: number; mustContain: string }[]; // [] = off-topic
};

type RetrievalReport = {
  commit: string; model: string; k: number; floor: number | null; rerank: "off" | "llm";
  recallAtInjected: number; mrr: number;
  injectedTokens: { median: number; p95: number };
  offTopicFalseInjection: number;
  latencyMs: { p50: number; p95: number };
  cases: { id: string; hit: boolean; rank: number | null; injectedTokens: number }[];
};
```

#### Acceptance criteria

1. A baseline run on current `main` behavior is committed as `eval/baseline.json`, and the PR body contains its summary. Done means the file exists and the PR quotes recall, MRR and the median/p95 injected tokens.
2. Re-running the same commit twice yields identical recall, MRR and token counts (latency excluded). This proves the cached embeddings make it deterministic. Failure looks like any of those values differing between runs.
3. Unit tests (CI) cover:
   - recall and MRR on hand-built rankings, including the empty-expected (off-topic) case
   - anchor matching across a chunk-boundary shift
   - the `--compare` tolerance logic
   - citation-validity scoring on recorded transcripts
4. With no `TEST_DATABASE_URL`, the runner exits non-zero with a clear message, and `npm run test` is unaffected.
5. No new npm dependencies (AGENTS.md §15); `git diff package-lock.json` is empty.

### D2 — Retrieval precision

Inject a small, relevant set of passages instead of filling the window.

- **Top-k cap.** `buildRAGContext` takes `min(budgetLimit, RAG_TOP_K)`. `RAG_TOP_K` is a constant in `packages/ai`. Its value comes from an eval sweep over {8, 12, 16, 24}, and the sweep table goes in the PR. The token budget remains a ceiling, not the target.
- **Relevance floor.** A fused candidate with vector similarity below `RAG_MIN_SIMILARITY` is dropped *unless* it also ranked in the full-text top results. This keeps exact-phrase hits, which matters for #271. If every candidate is dropped, nothing is injected and the grounding rule's search escape hatch still applies. The value is chosen from the off-topic versus answerable trade-off curve in D1 and recorded in the PR.
- **Follow-up query rewrite.** When the conversation has a prior exchange, the latest message plus the last turn are rewritten into a standalone search query with the chatbot's own model through the existing OpenRouter client. Limits: 1.5 s timeout, at most 64 output tokens. On timeout, error or empty output, the raw message is used (today's behavior). The rewrite is never shown to the user and never persisted beyond turn timing metadata.
- **Optional rerank.** A `Reranker` interface with `none` (default) and `llm` implementations. The LLM implementation scores the top `2k` candidates in one call and is selected by env `RAG_RERANK=llm`. It becomes the default only if the eval shows a recall@injected gain of at least 3 points with added p95 latency of at most 800 ms. Otherwise it ships disabled and the PR records why.
- Fix `AVG_CHUNK_TOKENS` to match the 1000-char chunks (250).

**Integration point (representative)**

```typescript
// packages/ai/src/token-budget.ts
export const AVG_CHUNK_TOKENS = 250;      // 1000 chars / CHARS_PER_TOKEN (rag-service.ts chunkSize)
export const RAG_TOP_K = 12;              // final value from D1 sweep
export const RAG_MIN_SIMILARITY = 0.25;   // final value from D1 curve

// apps/web/src/server/rag-context.ts
const limit = Math.min(args.chunkLimit, RAG_TOP_K);
const query = await rewriteFollowUp({ message, lastTurn, model, timeoutMs: 1500 }) ?? message;
const fused = await hybridSearch({ ..., query, limit: limit * 2 });
const kept = applyRelevanceFloor(fused, RAG_MIN_SIMILARITY);   // keeps FTS-ranked rows
const ranked = await reranker.rank(query, kept);                // "none" = identity
return ranked.slice(0, limit);
```

> **Note**
>
> The constant values in the sample are placeholders for the sweep, not decisions. The PR sets them from D1 data.

#### Acceptance criteria (eval, against D1 baseline)

1. recall@injected on answerable plus exact cases is at least 0.85, and at most 3 points below baseline.
2. Median injected tokens fall by at least 60% versus baseline on the default model.
3. At least 80% of off-topic cases inject zero passages.
4. Follow-up cases: recall@injected improves over baseline.
5. If answer mode can run (needs the key), the denial rate on answerable questions is no higher than baseline. If it cannot run, the PR says so explicitly.

#### Tests (CI)

- `applyRelevanceFloor`: drops low-similarity vector-only rows, keeps FTS-ranked rows, and returns empty when nothing qualifies.
- `rewriteFollowUp`: no history means no call. Timeout, error and empty output each fall back to the raw message (fake timers, mocked client via `jest.unstable_mockModule`).
- `buildRAGContext`: never exceeds `RAG_TOP_K` even when the budget allows 98+.
- Reranker: `none` is the identity, the env switch selects `llm`, and an `llm` failure falls back to the input order.
- `AVG_CHUNK_TOKENS`: a test pins it to the chunker's configured size divided by `CHARS_PER_TOKEN`.

### D3 — Answer-level citation protocol (server)

The model cites numbered passages, and the server resolves those refs into the sources the answer actually used.

- **Numbered passages.** `formatPassage` emits `[n] {fileName}, p. {page}`, or with no page `[n] {fileName}, part {chunkIndex+1}`. Refs are assigned per turn in the order passages enter the model's view: injected passages first, then `search_documents` results, which gain a `ref` field. A passage seen twice keeps its first ref.
- **One instruction.** The grounding rule becomes: "Mark each claim that relies on a passage with its number in square brackets, e.g. [2] or [1, 3]. Use only numbers of passages you were given. Never invent page numbers or file names." The `done` tool description says the same. The contradiction is gone.
- **Resolution.** After the final text, a pure `extractCitations(text, refTable)` parses `[n]`, `[n, m]` and `[n][m]`. Markers inside code spans are ignored. It returns valid refs in first-use order and drops unknown refs, emitting one `logWarn` with counts only (never content).
- **Persistence.** `metadata.citations` is added alongside the existing `sources`, which stays unchanged for back-compat and analytics. JSONB means no migration; the schema type is updated.
- **Exposure.** When `showSources` is true, the stream's message metadata carries `citations` with `{ref, fileName, pageNumber, excerpt}`. The excerpt is at most 280 chars of the cited chunk, cut at a word boundary. `fileId` is added only on owner-authenticated surfaces (dashboard preview, Student Chats). When `showSources` is false, no citation payload is sent.
- **Fallback.** No valid citations means `citations: []`, and the UI falls back to today's source list (D4).

**Citation shape (representative)**

```typescript
// packages/db/src/schema.ts — messages.metadata
citations?: Array<{
  ref: number;               // as shown in the answer text
  fileName: string;
  chunkIndex: number;        // server-side only; stripped from public payloads
  pageNumber?: number | null;
  excerpt: string;           // ≤ 280 chars
  fileId?: string;           // owner surfaces only
}>;
```

#### Acceptance criteria and tests

1. `extractCitations` unit tests cover single, list and adjacent refs; unknown refs; refs inside code spans; duplicate refs; and no refs at all.
2. A prompt-assembly test asserts the grounding rule and the `done` description carry the same citation instruction, and that neither contains "Do NOT put inline citations".
3. A `formatPassage` test checks the ref/page header, and the no-page fallback.
4. A turn-level test (mocked model, existing `cut-off-turn.test.ts` pattern) checks that a final answer citing [2] persists exactly one citation matching passage 2 and leaves `sources` unchanged.
5. Privacy tests:
   - The public shared-chat payload with `showSources=false` contains no `citations` key.
   - With `showSources=true`, it contains no `chunkIndex`, `fileId` or `similarity`, and every excerpt is at most 280 chars.
6. The D1 answer mode (when a key is available) reports citation validity of at least 95% on the default model. Without a key, the PR states that the check was not run.

### D4 — Citation footnotes in chat (UI)

Students and professors see which passage backs each claim, inline.

- **Presentational components** (props only, no data fetching):
  - `CitationMarker`: `{ref, active, onSelect}`. A superscript button with an accessible name like "Source 2".
  - `CitationList`: `{citations, activeRef, onSelect}`. A numbered footnote list showing file name, page and an expandable excerpt. A page link appears only when `fileId` is present: `/api/files/{fileId}/download#page={n}`.

  Both are built from the existing `SourceBadge` styling, Radix Popover/Collapsible and the current chat typography tokens.
- **Wiring.** `ChatMessage` renders `[n]` as `CitationMarker` through a react-markdown text transform, including while streaming. Clicking a marker highlights and scrolls to its footnote. With `showSources` on and citations present, `CitationList` replaces `SourceList`. With citations empty, `SourceList` renders exactly as today.
- **showSources off.** Markers are stripped from rendered text, including in copy and export of that message.
- New strings go into all four catalogs (`apps/web/messages/{en,fr,es,de}.json`) in their own commit.

#### Acceptance criteria and tests

1. Component tests (RTL):
   - the marker's accessible name and keyboard activation
   - the list renders file/page/excerpt, and shows a page link only with `fileId`
   - the list is empty when given no citations
2. `ChatMessage` tests:
   - with sources on and citations present, there are markers plus the footnote list and no badge list
   - with sources on and no citations, the badge list matches today's output
   - with sources off, no markers or brackets appear in the text
   - a partial streamed `[1` does not crash and resolves once complete
3. agent-browser QA on a local dev server with the eval corpus loaded:
   - a public chat answer with markers and footnotes (screenshot)
   - clicking a marker focuses its footnote (WebM)
   - the owner preview page link opens the PDF at the page (screenshot)
   - `showSources` off shows clean prose (screenshot)

   All are submitted with `obvious autobuild upload` against the tested head SHA.

### S1 — Login and registration limits use the trusted client IP

The login (5 per 15 min) and registration (3 per hour) limits can't be bypassed by rotating `X-Forwarded-For`.

- In `app/api/auth/[...all]/route.ts`, replace the inline leftmost-hop parsing with `getTrustedClientIp(request.headers)`. Nothing else changes: limits, fail-open behavior and the 429 body stay the same.
- Fix any comment that describes the old behavior.

#### Acceptance criteria and tests

1. Route test (mocked `checkRateLimit`): `x-forwarded-for: 1.1.1.1, 9.9.9.9` keys on `9.9.9.9`. With `x-real-ip: 8.8.8.8` present, the key is `8.8.8.8`.
2. Rotation test: six sign-in POSTs with different leftmost hops and the same edge hop all hit one bucket, so the sixth gets a 429. This uses an in-memory limiter fake.
3. `rg 'x-forwarded-for' apps/web/src/app/api/auth` is empty.
4. Backend-only, so there is no visual evidence; the PR states the reason.

### S2 — App-wide security headers, embed-aware

Dashboard, admin and auth pages can't be framed by other sites. Embeds keep working.

| Routes | Framing | Always |
| --- | --- | --- |
| `/embed/:path*`, `/chat/:path*` | No frame restriction (as today) | `X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin-when-cross-origin` · `Strict-Transport-Security: max-age=86400` |
| Everything else, including `/admin`, `/dashboard`, `/chatbot`, auth pages and the `admin.` subdomain rewrite | `Content-Security-Policy: frame-ancestors 'none'` + `X-Frame-Options: DENY` | `X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin-when-cross-origin` · `Strict-Transport-Security: max-age=86400` |

- Implemented in `next.config.js` `headers()` with a negative-lookahead source for the deny rule. Routes the existing download handler covers keep its stricter per-route headers.
- There is no full script CSP: inline scripts and analytics make that a separate, larger decision.

#### Acceptance criteria and tests

1. Unit test on the exported `headers()`: `/embed/abc/window` and `/chat/abc` get no frame-deny headers. `/admin`, `/dashboard`, `/login` and `/` get both. Every route gets nosniff, referrer and HSTS.
2. Production-mode check (`next build && next start`, curl matrix over the routes above) is recorded in the PR.
3. agent-browser: a local HTML page served from a different port frames `/embed/<token>/window` successfully (screenshot) and fails to frame `/dashboard` (screenshot plus the console's frame-ancestors error). Submitted with `obvious autobuild upload`.
4. Changing `next.config.js` is app config, not lint/ts/tool config. If a reviewer reads AGENTS.md §15 otherwise, the coder asks before merging.

## Delivery

- **D1–D4 → release branch `release/trustworthy-answers`** (draft release PR [#575](https://github.com/akhileshrangani4/teachanything/pull/575)), promoted to `main` in one merge. They are related, D2–D4 are judged against D1's baseline, and D3/D4 only make sense together. Each deliverable is one or more PRs into the release branch.
- **S1 and S2 → independent PRs to `main`**. They are unrelated to each other and to the AI work, and each is small enough to review alone.
- Conventional commits. Generated fixtures (embedding cache, baseline report) and locale catalogs go in their own commits.

> **Note**
>
> Planning findings. `test.yml` and `build.yml` only run on PRs to `main`, so child PRs into the release branch record local lint, type-check, test and build results in their bodies; full CI runs on the promotion PR #575. Building D1's embedding cache needs `OPENAI_API_KEY` once (the embedding client in `packages/ai/src/openrouter-client.ts` uses it). After that, retrieval mode runs keyless, as specified.

## Locked decisions, risks, open questions

> **Locked decisions**
>
> 1. Delivery: D1–D4 on `release/trustworthy-answers`; S1 and S2 as independent PRs to `main`.
> 2. D1 lands before any retrieval behavior change. D2's and D3's acceptance criteria are judged against D1's committed baseline.
> 3. No new npm dependencies and no CI workflow changes in this track (AGENTS.md §15). The eval runs locally, gated on `TEST_DATABASE_URL`.
> 4. No new retrieval vendor. Rerank goes through the existing OpenRouter client, is off by default, and is on only if it clears the +3-point recall / +800 ms p95 bar.
> 5. No pg_trgm retriever (#516 stays decided).
> 6. Students never get file access. They see file name, page and an excerpt of at most 280 chars, only when `showSources` is on. Page links are owner-only, through the existing session-checked download route.
> 7. `metadata.sources` stays as-is. `citations` is additive. No DB migration.
> 8. Zero valid citations means today's source list. A model that ignores the format degrades to current behavior, never to nothing.
> 9. S1 changes only IP derivation; limits and fail-open behavior are unchanged. S2 does not restrict framing for `/embed/*` or `/chat/*`.
> 10. Nothing in the Issue Triage off-limits list is touched.

### Risks the plan must cover

| Risk | Mitigation |
| --- | --- |
| A smaller context brings back #271's overconfident denials. | Exact-detail golden cases, the full-text bypass of the floor, the unchanged search escape hatch, and the answer-mode denial check when a key is available. |
| Open-weight models follow `[n]` unreliably. | A tolerant parser, the fallback to the source list, and a citation-validity metric. |
| The rewrite adds latency or misreads a follow-up. | 1.5 s timeout with fallback to the raw message, and follow-up golden cases. |
| Fixture licensing. | Only permissively licensed texts, with attribution in the fixtures README. |
| S2 matcher mistakes break LMS embeds. | Unit matrix, production-mode curl and a cross-origin iframe check before merge. |
| S1 depends on the edge setting `x-real-ip` or appending to XFF. | Same trust model `proxy.ts` already relies on. Behavior on the real host is an open question. |
| The release branch drifts from `main` while Issue Triage merges, for example #465 touching `stream-chat.ts`. | Rebase the release branch on `main` before each PR and before promotion; CI re-runs on the promotion PR. |

### Open questions

1. **OpenRouter key for answer-mode evals.** Without one, citation validity and the denial-rate check are unverified, and only the retrieval metrics gate D2/D3. Provide a key (stored as a secret) or accept retrieval-only gating.
2. **`showSources` default.** I'm leaving it off, so existing and new chatbots behave as today and citations reach students only where professors opt in. Turning it on for new chatbots would make provenance the norm, at the cost of a behavior change and a migration of the column default.
3. **Production edge.** Does production set `x-real-ip` and append to `X-Forwarded-For`? This affects S1's real-world effect, not its code.
