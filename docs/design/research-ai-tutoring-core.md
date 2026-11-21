> Exported from Obvious document `art_0xSIXg3p` ("AI tutoring core: findings and ranked improvements") on 2026-11-17. Content is unchanged from the live source.

# AI tutoring core: findings and ranked improvements

**Scope:** `packages/ai` and the chat streaming path in `apps/web` (repo `akhileshrangani4/teachanything`, `origin/main` at `7fee02e`). This was read-only research. No code, branches, PRs or GitHub comments were made.

**Evidence convention.** **Observed** means I read it in the code during this session (paths and line numbers are cited). **Inferred** means I reasoned from the code without measuring it in production. This document contains no production metrics of my own. Numbers quoted from code comments, such as "15 of 20 sampled production questions", belong to the comment authors and are cited as their claims.

**Load-bearing assumption.** The ranking assumes that answer quality, grounding and pedagogy are the main limits on value in the AI core. They are not assumed to be latency or model availability. No retrieval-quality or answer-quality measurement exists in the repo to confirm or break this (candidate 1 is about that gap). Before you commit to candidates 2 to 4, run candidate 1 on a few real courses. Several other explanations were not examined here and could also limit value: model choice (the default Llama 3.3 70B against the stronger tool models), the professor-written system prompts themselves, and coverage gaps in ingestion. Ingestion gaps such as OCR are owned by Issue Triage.

---

## 1. Map of what I explored

The pipeline runs as follows.

- **Ingestion.** `RAGService` (`packages/ai/src/rag-service.ts`) extracts PDF, DOCX, PPTX and text. It splits text with `RecursiveCharacterTextSplitter` at **1000 chars with 150 overlap** (`rag-service.ts:24-31`, about 250 tokens per chunk according to the comment). PDF chunks are page-aware through `\f` splitting and carry `metadata.pageNumber` (`chunkPagedText`, `rag-service.ts:325-347`).
- **Embeddings.** Each chunk is embedded one by one with OpenAI `text-embedding-3-small` at **1536 dimensions** (`models.ts` `EMBEDDING_MODEL`; `openrouter-client.ts:128-201`). Embeddings are stored in `file_chunks.embedding vector(1536)` with an **HNSW index** using `vector_cosine_ops`, m=24, ef_construction=128 (`packages/db/src/schema.ts:276-308`). A **GIN expression index on `to_tsvector('english', content)`** is created outside Drizzle (`packages/db/scripts/setup-indexes.sql`). The trigram index on chunks was dropped (#516).
- **Retrieval.** `hybridSearch` (`apps/web/src/server/hybrid-search.ts`) runs a vector retriever (HNSW with `hnsw.iterative_scan = relaxed_order`) and a Postgres FTS retriever (`plainto_tsquery`, OR-ed, or `websearch_to_tsquery` when the query contains a quoted phrase) concurrently. It overfetches `min(limit*2, 60)` from each and fuses them with **Reciprocal Rank Fusion** (k=60, FTS weight 2 for quoted phrases) in `packages/ai/src/rrf.ts`. pg_trgm is deliberately not used (comment at `hybrid-search.ts:99-103`). There is **no reranker**.
- **Context.** Every turn, `buildRAGContext` (`apps/web/src/server/rag-context.ts`) embeds **only the latest user message** and injects the fused chunks into the system prompt as `[Source: <name>, Part N]` (`format-passage.ts`). A file manifest capped at 20 names is injected alongside them.
- **Agentic loop.** Tool-capable models also get `search_documents`, `get_page`, `get_context_around`, `list_documents` and `done` (`apps/web/src/server/retrieval-tools.ts`), plus the render-only `showQuiz` study tool (`apps/web/src/server/chat/study-tools.ts`). The loop is capped at `MAX_AGENT_STEPS = 5` (`turn-end.ts:17`). If the loop produces nothing visible, a no-tools static fallback runs (`turn-endings.ts:162-217`).
- **Prompt.** `buildTurnPrompts` (`prompt-assembly.ts:152-215`) builds the prompt by concatenating the professor's `systemPrompt`, the manifest, the injected context, the grounding rule, the study addendum and the quiz-results note.
- **Models.** Five OpenRouter models, all tool-capable, are listed in `models.ts`, with a `DEPRECATED_MODEL_MAP` for migration. The default is Llama 3.3 70B.
- **Budget.** `token-budget.ts` reserves 80% of the context window for input, gives 60% of that to chunks, and fills history newest-first from at most the last 50 rows (`turn-context.ts:45-51`). `maxTokens` is clamped to 100–4000 (`lib/chat/helpers.ts:17-27`).
- **Spend control.** The only spend controls are Upstash rate limits (`rate-limit.ts`): 10 per 10 s per IP and 300 per minute per share token on public chat, and 30 per minute per user on authenticated chat.
- **Sources.** All retrieved chunks are persisted to `messages.metadata.sources`. They render as file badges only when the professor turns on `showSources`, which **defaults to false** (`schema.ts:185`; `ChatMessage.tsx:212`).

**Backlog check.** I ran `gh issue list --state open` and `gh pr list --state open` on 2026-11-13. Open issues: #559, #465, #463, #462, #399, #398, #137, #136, #129, #128, #126, all of them on the off-limits list. Open PRs: #572, #570, #567, #564, #563, #561, #550, #340. **No open issue backs any candidate below.** Each one would need a new issue. Related closed issues are cited where relevant (#271, #357, #377, #397, #516).

---

## 2. Ranked top 5 candidates

### Candidate 1: Retrieval and answer-quality eval harness (golden set + offline runner)

**What it is.** A small, versioned set of real course documents with question → expected passage (and optionally expected answer facts). A script runs `hybridSearch`/`buildRAGContext` and a turn against it and reports recall@k, MRR and "answered vs. denied". It runs on demand and, cheaply, in CI against a fixture DB.

**Who benefits.** Operators and maintainers directly. Professors and students indirectly, because every retrieval or prompt change can be checked before it ships rather than after a complaint.

**Evidence (observed).**
- No eval harness, golden set or recall/MRR code exists. A search for `eval`/`golden`/`recall@`/`ndcg` across `apps` and `packages` found only tool-schema and retrieval unit tests.
- The existing retrieval tests are structural, for example `apps/web/src/__tests__/server/hybrid-search-vector.test.ts`, which pins the `SET LOCAL` call order against a fake DB, and `hybrid-search-helpers.test.ts`.
- Tuning decisions are justified by ad-hoc production samples recorded only in comments: "ANDing every word … matched nothing for 15 of 20 sampled production questions" (`hybrid-search.ts:37-41`), "21 of 60 on the largest chatbot in Sep 2026" (`hybrid-search.ts:59-62`), and the chunk-size change for #271 (`rag-service.ts:24-25`).
- Model swaps are also driven by incidents found in production (comments in `models.ts` `DEPRECATED_MODEL_MAP`).

**Size.** M: one PR for fixtures and the retrieval runner, one PR for an answer-level judge pass and CI wiring.

**Risks.**
- Course materials may be copyrighted or private, so fixtures need permissively licensed or synthetic documents.
- An LLM-as-judge adds cost and noise. Keep retrieval metrics deterministic and make the answer judge opt-in.
- The fixture DB needs pgvector in CI (inferred; I did not inspect the CI config).

**Overlap check.** None. Not file pipeline, ratings (#559) or #399. It would *consume* #559's ratings later as a signal, but does not depend on them.

**Ranked first because** candidates 2–4 change retrieval and prompts, and #271 ("RAG can miss specific PDF details and answer with overconfident denial") shows a regression here goes unnoticed until a professor reports it.

---

### Candidate 2: Retrieval precision — smaller reranked context, relevance floor, conversation-aware query

**What it is.** Four changes:
- (a) Cap the per-turn injected context at a small top-k (order of 8–15), chosen by a reranker over the RRF candidates (a cross-encoder or a cheap LLM rerank), instead of letting the token budget decide.
- (b) Add a relevance floor so off-topic messages inject nothing.
- (c) Rewrite follow-up questions into a standalone query from the last turn before embedding them.
- (d) Fix the stale `AVG_CHUNK_TOKENS` constant.

**Who benefits.**
- Students: more focused answers and fewer "answered from the wrong chapter" cases.
- Professors: source lists that mean something (see candidate 3).
- Operators: fewer input tokens per step.

**Evidence (observed).**
- The chunk limit comes from the context window, not from relevance. `stream-chat.ts:101-110` calls `calculateChunkLimit` and passes the result as `chunkLimit` to `buildRAGContext` (`turn-context.ts:52-61`, `rag-context.ts:209-220`).
- `calculateChunkLimit` uses `AVG_CHUNK_TOKENS = 625`, documented as "2500 chars / CHARS_PER_TOKEN" (`token-budget.ts:27-28`). Chunks have been 1000 chars since #271 (`rag-service.ts:24-31`).
- `hybridSearch` overfetches `min(limit*2, 60)` per retriever and returns up to `limit` fused ids (`hybrid-search.ts:122, 158-164`). It has **no similarity threshold**: vector rows are returned whatever their distance.
- Pass 2 of the budget is called with `availableChunks: []` (`turn-context.ts:125`), so the injected context is never trimmed after retrieval. It is counted as fixed.
- `RAGService.rerank`, `keywordMatch`, `buildContext` and `cosineSimilarity` (`rag-service.ts:399-475`) are referenced only from `packages/ai/src/__tests__/rag-service.test.ts`. They are dead code, and the "rerank" there is just a sort by similarity.
- The static retrieval query is the raw latest message (`stream-chat.ts:83`, `rag-context.ts:150-162`). History is not used to form the query. In the agentic path the model writes its own `search_documents` queries (`retrieval-tools.ts:148-178`), which reduces this problem but does not fix the injected context.
- The system prompt, which carries the injected context, is re-sent on every agentic step. The `rag-context.ts:116-121` comment says so when capping the manifest, and the loop allows up to 5 steps (`turn-end.ts:17`).

**Inferred (arithmetic from code constants, not measured).** For the default Llama 3.3 70B (131,072 window) with the default 2000 max tokens:
- Input budget ≈ 0.8 × 131,072 − 2,000 ≈ 102.9k.
- Chunk share ≈ 61.7k, giving `calculateChunkLimit` ≈ 98.
- `hybridSearch` can return up to 98 of at most 120 fused ids.
- At about 250 tokens per chunk, that is on the order of 20–25k tokens of injected context per request, repeated on each agentic step.

Larger-window models hit the 120-id overfetch ceiling. This should be confirmed with real `metadata.timing`/log data before sizing the gain.

**Size.** M: (a)+(b) in one PR, (c) in one PR, (d) folded into either.

**Risks.**
- A smaller context can bring back the #271 failure (an overconfident "not in the materials"). Ship behind candidate 1, and keep the agentic `search_documents` escape hatch and the grounding rule in `prompt-assembly.ts:20-32`.
- A reranker adds one network hop of latency. Query rewriting adds a small LLM call, or can reuse the turn's model.
- Do not reintroduce pg_trgm (#516 rationale at `hybrid-search.ts:99-103`).

**Overlap check.** None. It builds on, and does not touch, #465 (turn lock) and #398 (quiz leak).

---

### Candidate 3: Answer-level citations — show what the answer used, linked to the passage

**What it is.** Number the passages the model sees ([1], [2] …) and require the model to cite them. Map the cited ids back to chunks server-side, then show **only cited sources** as clickable footnotes with page and snippet (and open the file at that page for uploads). Resolve the contradictory citation instructions. Revisit `showSources` defaulting to off.

**Who benefits.**
- Students: they can verify claims and find the page to study.
- Professors: they can audit whether answers are grounded, in Student Chats.

**Evidence (observed).**
- The grounding rule forbids inline citations: "Do NOT put inline citations, source tags, page numbers … the app shows the user the sources separately" (`prompt-assembly.ts:28-30`). The `done` tool says the opposite: "Cite the file and page for each claim" (`retrieval-tools.ts:316`).
- The sources shown are **everything retrieved**, not what the answer used: injected context sources merged with every tool hit (`turn-endings.ts:137-147`, `lib/chat/helpers.ts:50-70`). Combined with candidate 2's chunk volume, a badge list can cover most of the corpus.
- Chunks surfaced only by FTS get `similarity: 0` (`rag-context.ts:246-250`). Sources are sorted by similarity (`message-sources.ts:62-67`), so exact-phrase lexical hits rank last in the 5-badge cap (`source-list.tsx:18`).
- Badges are plain `<Badge>` with a tooltip, not links (`components/ui/source-badge.tsx:50-58`).
- `showSources` defaults to `false` (`schema.ts:185`, `settings-draft.ts:40`) and gates rendering (`ChatMessage.tsx:212`).
- The injected passage header omits the page number (`format-passage.ts:12`, `[Source: name, Part N]`), although `search_documents` results include `pageNumber` (`retrieval-tools.ts:172-177`). The model therefore cannot cite pages from the injected context.

**Inferred.** With `showSources` off and inline citations forbidden, a default chatbot gives the student no provenance at all. I did not query how many chatbots have the toggle on.

**Size.** M: one PR for cited-id protocol and server mapping with the prompt fix, one PR for clickable footnotes and a page viewer link.

**Risks.**
- Open-weight models vary in how reliably they follow citation formats. Needs candidate 1 plus a tolerant parser, with a fallback to the current behaviour when nothing is cited.
- Must not leak raw retrieval results to public bots (the privacy rule in `stream-chat.ts:59-60`). Send only display fields and short snippets.
- Opening a file needs a signed URL path for the embed/public surfaces. There is a download rate limiter in `rate-limit.ts:132`, but I did not inspect the access rules.

**Overlap check.** Not #559 (ratings). It builds on the closed #397 grouping work. Not file pipeline.

---

### Candidate 4: Pedagogy modes per chatbot (Direct / Guided-Socratic / Hints-only) with an answer-dumping guardrail

**What it is.** A professor-selected `tutoringMode` on the chatbot that adds a server-owned pedagogy block to the system prompt:
- **Guided:** ask before telling and check understanding.
- **Hints-only:** never give final answers to problem-set-style questions, escalate hints step by step, and refuse to complete work that looks graded.

Optionally, the professor can tag specific files as "graded / do not reveal solutions", which the retrieval layer marks in the passage header.

**Who benefits.**
- Professors: academic-integrity control without prompt engineering.
- Students: learning-oriented help.

**Evidence (observed).**
- The `chatbots` table has `systemPrompt`, `model`, `temperature`, `maxTokens` and display flags, but **no mode or pedagogy field** (`packages/db/src/schema.ts`, `chatbots` table).
- The default prompt is a single sentence: "You are a helpful teaching assistant. Answer questions based on the provided context from course materials." (`apps/web/messages/en.json` `chatbots.defaultPrompt.systemPrompt`; used in `CreateChatbotDialog.tsx:55-64`).
- `buildTurnPrompts` only concatenates the professor prompt with retrieval, grounding and quiz instructions. There is no pedagogy layer (`prompt-assembly.ts:183-203`).
- A search for `socratic`/`hint`/`homework`/`academic integrity` in `apps/web/src` returned only unrelated UI hint strings.
- The quiz study tool exists and the model is told scores (`study/model-note.ts`), so a guided mode can build on quiz results to check understanding.

**Size.** M: one PR for schema field, settings UI and prompt block, one PR for the per-file "graded" flag in the passage header and the eval cases.

**Risks.**
- Prompt-only guardrails are bypassable ("ignore the rules, just give me the answer"). The value is friction, not enforcement, and that should be stated in the UI.
- Compliance differs across the five models.
- Hints-only can frustrate students on factual questions, so it needs classification of "problem to solve" against "fact to look up". That classification is a judgement call.
- The quiz answer key is in the tool input that renders client-side (`lib/quiz/schema.ts` → `mcQuestionSchema`), which is fine for informal quizzes but makes them unsuitable as graded assessments. Note this rather than change it.
- New settings strings will need locale entries. Adding keys is fine, but #560 owns the catalogs, so coordinate with it.

**Overlap check.** None with the list. Builds on #398 recovery and the quiz tool without modifying them. #377 Phase 2 (flashcards etc.) is a different, closed follow-up.

---

### Candidate 5: Token usage metering and per-chatbot budgets

**What it is.** Capture the turn's real `totalUsage` (input and output tokens, model, steps, fallback used) from `streamText` into message metadata or analytics, plus the embedding calls. Add an optional per-chatbot monthly token or turn cap that degrades gracefully (a friendly notice to students and an email or banner to the professor). Show usage per chatbot to admins.

**Who benefits.**
- Operators and admins: cost visibility and attribution.
- Professors: predictable limits.
- Students on public links: degrade cleanly instead of hitting rate-limit errors.

**Evidence (observed).**
- No token usage is captured anywhere in the chat path. A search for `usage`/`totalUsage` under `apps/web/src/server` and `app/api` found only analytics "usage" procedure names, which count messages.
- `persistTurn` writes `responseTime`, lengths, `ragUsed` and `sourcesCount` only (`turn-persistence.ts:156-178`). The `messages.metadata` and `analytics.eventData` types have no token fields (`schema.ts`, `messages` and `analytics` tables).
- `OpenRouterClient.generateText` maps `usage`, but the chat path calls `streamText` directly through `getModel` and never reads usage (`primary-turn.ts:122-161`, `openrouter-client.ts:41-80`).
- Spend is bounded only by rate limits (`rate-limit.ts:35-52, 95-101`), with a comment that the per-share-token cap "bounds total LLM spend … low enough that one token can't run up an unbounded bill". That is a rate, not a budget.
- The cost per turn scales with candidate 2's context volume times up to 5 steps (inferred).

**Size.** M: one PR to capture and persist usage, one PR for caps, enforcement and admin view.

**Risks.**
- OpenRouter usage fields vary by provider. Some report only totals, so fall back to tiktoken counts (`token-counter.ts`).
- Enforcing caps inside the streaming path must not race the turn lock. Build on #465, do not modify it.
- A cap that fires mid-semester is a support burden, so make it opt-in with warnings first.

**Overlap check.** Not on the list. **Flag:** surfacing usage on dashboards brushes the on-hold #131 (session-level analytics insights). Keep this to cost metering and leave session insights to #131. Not #559.

---

## 3. Considered and rejected (or folded)

- **Reintroduce pg_trgm in hybrid search.** Rejected: removed for cause. It averaged 11.7 s per call for 0.6 rows according to the comment at `hybrid-search.ts:99-103` (#516).
- **Language-aware FTS** (`'english'` is hard-coded in `hybrid-search.ts:45-47, 147-151` and in the GIN index). Folded into candidate 2 as a follow-up. It needs a per-chatbot language and an index migration, and the value is unproven without candidate 1. Inferred relevance: `models.ts` mentions multilingual courses.
- **Conversation summarization / long-term memory.** Rejected for now. History is the last 50 rows filled newest-first within the budget (`turn-context.ts:45-51, 101-136`). With windows of 128k or more, the budget rarely binds (inferred). Nothing shows sessions long enough to matter.
- **Cross-model fallback via OpenRouter multi-model routing.** Rejected here: it is reliability, not answer quality. Belongs to the platform-health track. Evidence: the fallback reuses the same model (`turn-endings.ts:182-193`), and the Mistral removal incident is recorded in `models.ts`.
- **Batch embeddings with `embedMany`.** Rejected: ingestion throughput sits next to the file-pipeline work owned by Issue Triage (#462/#463). Evidence: per-chunk `embed` in micro-batches of 10 (`openrouter-client.ts:174-201`).
- **Delete the dead `RAGService` helpers** (`rerank`, `keywordMatch`, `buildContext`, `cosineSimilarity`). Folded into candidate 2. Not user-visible on its own.
- **Phase 2 study tools** (flashcards, matching, mind map from #377). Rejected for this track: a product feature, better owned by the product-research track. It would also add tool calls through the #398 recovery path.
- **Cap the `systemPrompt` size** (`schema.ts`-backed zod allows up to 1,000,000 chars in `routers/chatbot/schemas.ts:14`). Rejected as an edge case. It is budgeted as fixed tokens, so the only effect is crowding out history.
- **Server-side quiz grading / hidden answer keys.** Rejected for now: only matters if quizzes become graded. Noted under candidate 4's risks.
- **Student feedback on answers as a quality signal.** Rejected: owned by #559.

---

## 4. Open questions

1. How many chatbots have `showSources = true`? This decides whether candidate 3 needs a default change or only better rendering. Needs a DB query by someone with production access.
2. What are the real injected-context sizes per turn? Logs from `rag-context.ts:261-267` (`chunkCount`, `chunkLimit`) or `metadata.timing` would confirm or break candidate 2's inferred 20–25k-token estimate.
3. Is there an approved source of course documents (licensed or synthetic) for the candidate 1 golden set, and who labels expected passages?
4. Is a reranker on a third-party API (for example Cohere or Jina via HTTP) acceptable, given that course content would leave OpenAI/OpenRouter? Or must it be self-hosted or LLM-based?
5. For candidate 4, does the product want hard refusals on graded work, or soft friction? And should professors tag files as graded, or should it be inferred?
6. For candidate 5, who pays and is the budget unit per chatbot, per professor or per institution? This determines where the cap lives.

*Read from `origin/main` @ `7fee02e` on 2026-11-13.*
