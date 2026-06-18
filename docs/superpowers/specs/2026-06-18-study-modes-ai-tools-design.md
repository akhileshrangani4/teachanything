# Study modes as native `ai@6` tools — design

- **Date:** 2026-06-18
- **Branch:** `feat/study-modes-ai-tools`
- **Status:** Approved for planning
- **Supersedes:** PR #313 (`feat/structured-study-modes`) — works and passes 411 tests, but **blocked in review**.

## 1. Context

PR #313 added five structured study modes (quiz, flashcards, test, mind map, matching) as a hand-rolled
generative-UI system: a regex intent detector, a canonical-trigger round-trip, a mode registry, a custom
stream-event protocol, and a server-side buffer → `JSON.parse` → `schema.parse` → fallback path. The
maintainer blocked it (`CHANGES_REQUESTED`): this is a reimplementation of generative UI that `ai@6`
provides natively, and the team should not own that custom surface.

This design rebuilds the same five modes on `ai@6` native **tools**. Each mode is a render-only tool whose
`inputSchema` is the existing Zod schema; the model calls the tool with the payload; the client renders the
widget by walking `message.parts`. No regex detection, no `JSON.parse`, no buffering, no fallback string,
no mode registry, no custom stream union.

## 2. Goal & non-goals

**Goal.** Replace the custom generative-UI surface with native `ai@6` tools while preserving every behavior
of the current chat path (RAG, token budgeting, persistence, analytics, rate limiting, public/embed access,
reasoning non-leak, cancel, truncation badge).

**Non-goals.**
- No new study modes beyond the five.
- No change to chatbot CRUD, file processing, analytics dashboards, or auth.
- tRPC stays everywhere **except** the chat send-path.

## 3. Locked decisions

1. **No confirmation gate.** Tools are render-only; the model calls `showQuiz` directly when it judges a
   study tool is wanted, and the client renders immediately. Tools already fix the old "don't make
   flashcards" false-trigger problem via the model's own intent understanding, so no `needsApproval`, no
   `addToolApprovalResponse`, no approval parts.
2. **No database migration.** All structured state persists in the existing `messages.metadata` `jsonb`
   column. The only `schema.ts` edit is widening the `.$type<>()` generic (compile-time only — Drizzle emits
   no SQL for a `jsonb` → `jsonb` no-op). No new tables, no new columns.
3. **Full send-path migration; read-paths stay tRPC.** The streaming send-path moves to Next.js Route
   Handlers; `getHistory` / `deleteConversation` and all other tRPC stay unchanged.
4. **Reuse #313 assets.** Keep the Zod schemas, types, grading/game helpers, and the five widget components.
   Delete the regex detection, the strict-JSON system instructions, the `lib/modes/*` registry, the confirm
   card, and the custom stream protocol.

## 4. Architecture: what moves

| Concern | Today | After |
|---|---|---|
| Send + stream | tRPC subscription `sendMessageStream` / `sendSharedMessageStream` | `POST /api/chat` (auth) + `POST /api/chat/shared` (public/embed) |
| Client orchestration | custom `useChatState` + `useChat` + `useChatbot` | `@ai-sdk/react` `useChat` (`DefaultChatTransport`), wrapped by thin `useChat`/`useChatbot` keeping today's return shape |
| Wire protocol | custom `{metadata,text,thinking,done}` union | AI SDK UI message stream (`toUIMessageStreamResponse`) |
| Read paths (`getHistory`, `deleteConversation`) | tRPC | **unchanged** |

The shared `processMessage` async generator becomes a plain `streamChat()` helper called by both routes. It
keeps **all** existing logic — conversation get/create, RAG via `buildRAGContext`, two-pass token budgeting,
history trim, persistence, analytics, rate limiting — and ends in
`streamText({ model, system, messages, tools }).toUIMessageStreamResponse(...)` instead of a hand-driven
`fullStream` loop.

## 5. Server design

### 5.1 Tools (`apps/web/src/server/chat/study-tools.ts`)

One render-only tool per mode, **no `execute`** — the payload *is* the input, so the call resolves to an
`input-available` part and the model run ends after it (no second step, no tool-result round-trip).

```ts
import { tool } from "ai";
import { quizSchema } from "@/lib/quiz";
// flashcardSchema, testSchema, mindMapSchema, matchingSchema

export const studyTools = {
  showQuiz:       tool({ description: "Render an interactive multiple-choice quiz…", inputSchema: quizSchema }),
  showFlashcards: tool({ description: "Render a flip-through flashcard deck…",       inputSchema: flashcardSchema }),
  showTest:       tool({ description: "Render a graded test (MC + free-response)…",  inputSchema: testSchema }),
  showMindMap:    tool({ description: "Render a collapsible concept mind map…",      inputSchema: mindMapSchema }),
  showMatching:   tool({ description: "Render a two-column matching game…",          inputSchema: matchingSchema }),
} as const;
```

- The five `*_SYSTEM_INSTRUCTION` strict-JSON blocks are deleted. Their guidance moves into each tool's
  `description` plus `.describe()` on schema fields, and one short paragraph appended to the system prompt
  telling the model the tools exist and to prefer them when a student asks to be quizzed / to study / etc.
- `OpenRouterClient.streamText` gains one optional `tools` param so provider config stays centralized; the
  route calls it and then `.toUIMessageStreamResponse(...)`.

### 5.2 Routes (`/api/chat`, `/api/chat/shared`)

Two thin Route Handlers mirroring today's two tRPC procedures, sharing the `streamChat()` helper:

- `/api/chat` — authenticated: resolve chatbot by `chatbotId`, verify ownership, authenticated rate limit,
  `eventType: "message_sent"`.
- `/api/chat/shared` — public/embed: resolve chatbot by `shareToken`, check `sharingEnabled`, public rate
  limit keyed by `shareToken:ip`, `eventType: "shared_message_sent"`.

Each request carries `{ id: sessionId, message: <latest UIMessage> }` (transport
`prepareSendMessagesRequest` sends only the newest message); the server loads prior history from the DB so
the DB stays the source of truth — mirroring today.

**sessionId ownership changes.** Today the server generates `sessionId` when absent and returns it in the
first metadata event. With the AI SDK transport the client generates it up front (`nanoid`) and passes it
as the request `id` on every turn — simpler, and it removes the early-yield handshake. The route uses that
`id` for conversation get/create exactly as `processMessage` does now.

### 5.3 Preserved behaviors

- **RAG sources / responseTime / truncated** stream via `toUIMessageStreamResponse({ messageMetadata })` and
  land on `message.metadata`; client reads them there.
- **Reasoning non-leak on public bots:** `sendReasoning: false` keeps reasoning text off the wire.
- **Truncation badge:** `finishReason === "length"` → `metadata.truncated` → existing amber badge.
- **Cancel/stop:** AI SDK `stop()` replaces the manual abort + 5-minute timeout; partial-save-on-cancel is
  re-checked against `onFinish` / `onError`.

## 6. Client design

- `ChatMessage` maps `message.parts` instead of `message.content`:

```tsx
message.parts.map((part) => {
  if (part.type === "text") return <MessageContent markdown>{part.text}</MessageContent>;
  if (part.type === "tool-showQuiz" && part.state === "input-available")
    return <QuizMessage quiz={part.input} />; // part.input typed as Quiz — no casts
  // …showFlashcards / showTest / showMindMap / showMatching
});
```

- `StreamingMessage`'s separate content buffer is removed — AI SDK keeps the in-flight assistant message in
  `messages` live; the typing indicator keys off `status === "submitted"`.
- Thin `useChat`/`useChatbot` wrappers around `@ai-sdk/react` `useChat` preserve the exact return shape
  `ChatInterface` and the three pages consume (`messages`, `isStreaming`, `handleSendMessage`, `stop`,
  `resetChat`, `error`), so those callers change minimally.

## 7. Persistence & rehydration (no migration)

- `messages.metadata` `$type<>()` widens to add `parts?: UIMessagePart[]` and `truncated?: boolean`
  alongside today's `sources` / `responseTime` / `ragUsed`. Type-only change.
- The route's `toUIMessageStreamResponse({ onFinish })` persists the new user message (`content` = text) and
  the assistant message (`content` = concatenated text or `""`; `metadata.parts` = full parts incl. tool
  payloads) — the same two-insert pattern as today.
- A `toUIMessage(row)` helper rehydrates: `parts = metadata.parts ?? [{ type: "text", text: content }]`, so
  **legacy text rows and tool messages both reconstruct**. These seed `useChat`'s initial `messages`,
  loaded via the unchanged `getHistory` tRPC query.

## 8. The five modes & reuse

Reused from #313 essentially as-is (minus their regex + instruction exports):

- Schemas/types/helpers: `lib/quiz.ts`, `lib/questions.ts`, `lib/flashcards.ts`, `lib/test-mode.ts`,
  `lib/mindmap.ts`, `lib/matching.ts`, `lib/matching-game.ts`, `lib/grading.ts`.
- Widgets: `QuizMessage`, `FlashcardMessage`, `TestMessage`, `MindMapMessage`, `MatchingMessage`.

**Test mode** is the only mode with two-way interaction: the student's free-response answers submit as a
follow-up `sendMessage`, graded by the existing `lib/grading.ts` helper (preserves #313's "grading as a chat
follow-up"). The legacy back-compat default `type: "multiple_choice"` stays in `testSchema`.

## 9. Deleted surface

`lib/modes/*` (registry, types, detection, per-mode descriptors), `ConfirmModeCard.tsx`, the custom
`StreamData` union in `useChatState.ts`, the detection/registry/canonical-trigger tests, and the
buffer/parse/fallback block. Net result: a large reduction in custom surface — the review's ask.

## 10. Testing

- **Carry over:** schema tests (`quiz.test.ts`, etc.) and grading/game-logic tests — pure logic, high value.
- **Delete with their code:** detection/registry/canonical-trigger tests.
- **New:** `toUIMessage` / persistence mapping (legacy row + tool-part round-trip) and `studyTools` shape.
- Per AGENTS.md we skip component tests, so the codecov 0% on widgets is expected and not chased; the logic
  underneath is what's tested.

## 11. Risks

1. **AI SDK v6 transport surface** is the real work and highest-uncertainty area: request/response shaping
   for the two entry points, `prepareSendMessagesRequest`, and `onFinish` persistence.
2. **Cancel/stop + timeout** semantics need re-checking against `onFinish` / `onError`.
3. **Reasoning non-leak** on public bots must be explicitly preserved (`sendReasoning: false`).

## 12. Sequencing

1. **Foundation + quiz end-to-end.** Install `@ai-sdk/react`; build `/api/chat` + `/api/chat/shared` and
   `streamChat()`; wire `useChat`/`useChatbot` wrappers; port the quiz schema as `showQuiz`; render via
   `message.parts`; prove persistence + rehydrate + public/embed all work with one mode.
2. **Add the remaining four tools + widgets** (flashcards, test, mind map, matching) — cheap once the
   harness is proven.
3. **Test-mode grading follow-up** wired through `lib/grading.ts`.
4. **Delete the dead custom surface** and its tests.

## 13. AGENTS.md alignment & deliberate deviations

This design follows AGENTS.md. It departs from three defaults — each mandated by the maintainer-approved
native-tools approach, flagged here per §15 ("be direct; flag problematic requirements"):

- **New dependency `@ai-sdk/react`** (§15: don't add deps unless explicitly asked). The client
  `useChat` / `message.parts` / transport surface needs it; the review explicitly prescribes it. `ai@6`
  and `@openrouter/ai-sdk-provider` are already in `packages/ai`. → Explicitly sanctioned.
- **Chat send-path moves from tRPC to App Router Route Handlers** (§7: all API logic in
  `server/routers/`). The AI SDK chat transport speaks HTTP, so `/api/chat` + `/api/chat/shared` are
  required. The repo already runs route handlers (e.g. `/api/jobs/process-file`, §10); every *other* API
  stays in tRPC. → Approach-mandated.
- **`schema.ts` edit is type-only, NOT a schema change** (§15: no DB schema change without a migration
  plan). Widening the `metadata` `$type<>()` generic emits no SQL and needs no migration; all new state
  stays inside the existing `jsonb` column. → Compliant by construction.

Otherwise it conforms: conventional commits (§13), Zod at boundaries (§6), ownership checks on both
routes (§7), `lib/logger.ts` not `console.log` (§14), unit tests for pure logic + skip component tests
(§12), small focused functions/files (§15), and the pre-commit hook is **fixed, not bypassed** (§14).
