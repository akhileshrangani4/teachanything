# Teach Anything: tool-calling RAG and professor insights

Project description for the Software Factory workshop (Seattle, April 21 2026).

## What it does

Teach Anything is an EdTech chatbot platform. Professors create course-specific chatbots by uploading materials (PDFs, Word, PowerPoint) or crawling URLs; students chat with those bots. Two enhancements:

1. Convert the current "always-on RAG, stuffed into system prompt" pipeline into LLM tool calling so the model decides when and how to retrieve context.
2. Extend the existing analytics table into a professor-facing insights dashboard.

## Goals & success criteria

- Simple messages (greetings, follow-ups) skip retrieval entirely, cutting time-to-first-token and embedding spend.
- Complex questions can issue multi-hop retrievals (search, then search again with refined terms) instead of one shot.
- Professors get a dashboard surfacing: top questions per chatbot, topic clusters where students struggle (low answer confidence, thumbs-down, repeated rephrasings), engagement over time.
- No regression in answer quality vs. the current system-prompt stuffing approach.

## Scope & constraints

- In scope: tool-calling retrieval loop, multi-hop search tool, analytics clustering + dashboard UI.
- Out of scope: rewriting the file ingestion pipeline, swapping LLM providers, student-facing analytics, the crawler itself.
- Constraints: must work with open-source models on OpenRouter that support tool calling. Stack is fixed: Next.js 16, tRPC subscriptions, Vercel AI SDK, Postgres + pgvector, Drizzle.

## Key roles & users

- Professors: create chatbots, upload/crawl materials, view analytics.
- Students: chat with shared chatbots (auth optional via share token).
- Admins: approve new users.

## Domain context

EdTech. Existing RAG pipeline chunks at 2500 chars with 250 overlap, embeds via OpenAI `text-embedding-3-small`, retrieves via pgvector cosine similarity with a chunk limit derived from the model's context window. Token budgeting is already sophisticated (`allocateTokenBudget` in `packages/ai`). Research needed on tool-calling RAG patterns (e.g. Cursor, Perplexity, Anthropic's agentic retrieval) and which analytics dimensions actually drive professor decisions vs. look nice in a dashboard.
