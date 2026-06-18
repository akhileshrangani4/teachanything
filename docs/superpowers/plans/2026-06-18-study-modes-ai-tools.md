# Study Modes as Native `ai@6` Tools — Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the chatbot's streaming send-path from a tRPC subscription to the native `ai@6` chat transport (`/api/chat` route handlers + `@ai-sdk/react` `useChat`), and prove it end-to-end with one render-only study tool (`showQuiz`).

**Architecture:** A shared `streamChat()` helper re-homes everything the current `processMessage` generator does (conversation get/create, RAG, token budgeting, history, persistence, analytics) and ends in `streamText({ tools }).toUIMessageStreamResponse(...)`. Two thin Route Handlers (`/api/chat` authenticated, `/api/chat/shared` public/embed) call it. The model renders a quiz by calling the `showQuiz` tool (its `inputSchema` is the existing `quizSchema`); the client walks `message.parts` and renders `<QuizMessage>` for the `tool-showQuiz` part. Structured payloads persist in the existing `messages.metadata` JSONB — no DB migration.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5.9 · `ai@^6.0.168` + `@ai-sdk/react` · `@openrouter/ai-sdk-provider` · Drizzle ORM + Postgres · tRPC 11 (read-paths only) · Zod · Jest (ESM).

## Global Constraints

Copied verbatim from the spec (`docs/superpowers/specs/2026-06-18-study-modes-ai-tools-design.md`). Every task implicitly includes these.

- **No database migration.** All structured state persists inside the existing `messages.metadata` JSONB column. The only `schema.ts` change is widening the `.$type<>()` generic (compile-time only). No new tables, no new columns.
- **`packages/db` must not import app code or the `ai` package.** Persist parts as `unknown` in the metadata type; the app layer owns the real `UIMessagePart` type.
- **Reasoning must not leak on public bots:** always pass `sendReasoning: false` to `toUIMessageStreamResponse`.
- **Preserve current chat behaviors:** RAG sources per message, token budgeting, analytics events (`message_sent` / `shared_message_sent`), rate limiting (authenticated vs public), the truncated-at-token-limit badge, and all three entry points (authenticated page, public share page, embed window).
- **No behavior change from the migration itself:** a new sessionId is generated per page load (matches today — no cross-reload history rehydration in this phase).
- **Commits:** conventional commits (`<type>(scope): <desc>`), **no Claude attribution**. The Husky pre-commit hook (`lint-staged` → `check-types` → `lint` → `test`) must pass — **fix issues, never `--no-verify`** (AGENTS.md §14).
- **AI SDK v6 renames to respect:** tool config uses `inputSchema` (not `parameters`); `maxTokens` → `maxOutputTokens`; multi-step is `stopWhen: stepCountIs(n)` (not `maxSteps`); `convertToModelMessages()` is **async** (await it); the client tool-result setter is `addToolResult`.

---

## File Structure

**Create:**
- `apps/web/src/lib/questions.ts` — shared MC/open question Zod schemas (ported from #313, schemas only).
- `apps/web/src/lib/quiz.ts` — `quizSchema` + `Quiz` type (ported; **no** detection/instruction exports).
- `apps/web/src/server/chat/study-tools.ts` — the `studyTools` tool map (quiz only) + `StudyUIMessage` type + system-prompt addendum.
- `apps/web/src/server/chat/ui-messages.ts` — DB-row ⇄ `UIMessage` mapping helpers.
- `apps/web/src/server/chat/stream-chat.ts` — shared streaming orchestrator (ports `processMessage`).
- `apps/web/src/app/api/chat/route.ts` — authenticated Route Handler.
- `apps/web/src/app/api/chat/shared/route.ts` — public/embed Route Handler.
- `apps/web/src/components/chat/messages/QuizMessage.tsx` — quiz widget (ported from #313).
- Tests: `apps/web/src/__tests__/lib/quiz.test.ts`, `apps/web/src/__tests__/server/chat/ui-messages.test.ts`, `apps/web/src/__tests__/server/chat/study-tools.test.ts`.

**Modify:**
- `apps/web/package.json` — add `ai` + `@ai-sdk/react`.
- `packages/ai/src/openrouter-client.ts` — add `getModel()`.
- `packages/db/src/schema.ts` — widen `messages.metadata` `.$type<>()`.
- `apps/web/src/hooks/useChat.ts` — wrap `@ai-sdk/react` `useChat` (public).
- `apps/web/src/hooks/useChatbot.ts` — wrap `@ai-sdk/react` `useChat` (authenticated).
- `apps/web/src/components/chat/messages/ChatMessage.tsx` — render `message.parts`.
- `apps/web/src/components/chat/messages/ChatInterface.tsx` — consume `UIMessage[]` + `status`.
- `apps/web/src/app/chat/[shareToken]/page.tsx`, `apps/web/src/app/chatbot/[id]/page.tsx`, `apps/web/src/app/embed/[shareToken]/window/page.tsx` — pass new props.
- `apps/web/src/server/routers/chat.ts` — remove the two streaming subscriptions; keep `getHistory` + `deleteConversation`.

**Delete:**
- `apps/web/src/hooks/useChatState.ts` — custom state machine (replaced by `@ai-sdk/react`).

---

## Task 1: Dependencies + expose the OpenRouter model

**Files:**
- Modify: `apps/web/package.json` (`dependencies`)
- Modify: `packages/ai/src/openrouter-client.ts`

**Interfaces:**
- Produces: `OpenRouterClient.getModel(model: SupportedModel): LanguageModel` — returns the provider model instance for use with `streamText`.

- [ ] **Step 1: Add the AI SDK deps to the web app.** Edit `apps/web/package.json` `dependencies`, adding (keep alphabetical with siblings):

```jsonc
"@ai-sdk/react": "^2.0.0",
"ai": "^6.0.168",
```

Then install from the repo root:

```bash
npm install
```

Expected: install succeeds; `apps/web/node_modules/@ai-sdk/react` exists. (Note per AGENTS.md §15 this is an explicitly-sanctioned dependency add — the maintainer's review prescribes the AI SDK transport.)

- [ ] **Step 2: Verify the installed `@ai-sdk/react` client API matches the plan.** The server `ai` API was byte-verified; the client API was from docs. Confirm the surface before building on it:

```bash
cd apps/web && node -e "const r=require('@ai-sdk/react'); console.log(Object.keys(r))"
grep -rE "addToolResult|prepareSendMessagesRequest|ChatStatus" node_modules/@ai-sdk/react/dist/*.d.ts | head
```

Expected: `useChat` is exported; `status` union is `'submitted' | 'streaming' | 'ready' | 'error'`; the tool-result setter is `addToolResult`. If anything differs, adjust Tasks 7–9 accordingly.

- [ ] **Step 3: Add `getModel` to the OpenRouter client.** In `packages/ai/src/openrouter-client.ts`, add a method to the `OpenRouterClient` class (right after the constructor), and import the type:

```ts
import type { LanguageModel } from "ai";
```

```ts
  /**
   * Return the provider model instance for direct use with the AI SDK's
   * `streamText` (e.g. when registering tools and returning a UI message
   * stream). Provider configuration stays centralized here.
   */
  getModel(model: SupportedModel): LanguageModel {
    return this.client(model);
  }
```

- [ ] **Step 4: Type-check.**

```bash
npm run check-types
```

Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/package.json package-lock.json packages/ai/src/openrouter-client.ts
git commit -m "feat(ai): add AI SDK react deps and expose getModel for tool streaming"
```

---

## Task 2: Port the quiz + shared question schemas

**Files:**
- Create: `apps/web/src/lib/questions.ts`
- Create: `apps/web/src/lib/quiz.ts`
- Test: `apps/web/src/__tests__/lib/quiz.test.ts`

**Interfaces:**
- Produces: `quizSchema` (Zod), `type Quiz = { quiz_title: string; questions: MCQuestion[] }`, `type QuizQuestion = MCQuestion`; `mcQuestionSchema`, `type MCQuestion`.

- [ ] **Step 1: Write the failing test.** Create `apps/web/src/__tests__/lib/quiz.test.ts`:

```ts
import { describe, it, expect } from "@jest/globals";
import { quizSchema } from "@/lib/quiz";

describe("quizSchema", () => {
  it("accepts a valid quiz", () => {
    const result = quizSchema.safeParse({
      quiz_title: "Photosynthesis",
      questions: [
        {
          question: "What gas do plants absorb?",
          options: ["CO2", "O2"],
          correct_answer: "CO2",
          explanation: "Plants take in carbon dioxide.",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a quiz whose correct_answer is not one of the options", () => {
    const result = quizSchema.safeParse({
      quiz_title: "Bad",
      questions: [
        {
          question: "Q?",
          options: ["A", "B"],
          correct_answer: "C",
          explanation: "nope",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 5 questions", () => {
    const q = {
      question: "Q?",
      options: ["A", "B"],
      correct_answer: "A",
      explanation: "x",
    };
    const result = quizSchema.safeParse({
      quiz_title: "Too long",
      questions: Array(6).fill(q),
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.**

```bash
cd apps/web && npx jest src/__tests__/lib/quiz.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/quiz'`.

- [ ] **Step 3: Create `apps/web/src/lib/questions.ts`** (schemas only — these have no detection/instruction exports to drop):

```ts
import { z } from "zod";

export const mcQuestionSchema = z
  .object({
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(4),
    correct_answer: z.string().min(1),
    explanation: z.string().min(1),
  })
  .superRefine((q, ctx) => {
    if (!q.options.includes(q.correct_answer)) {
      ctx.addIssue({
        code: "custom",
        message: "correct_answer must be one of the options",
        path: ["correct_answer"],
      });
    }
  });

export type MCQuestion = z.infer<typeof mcQuestionSchema>;
```

> Note: `questions.ts` in #313 also holds `testMcQuestionSchema` / `openQuestionSchema` / `testQuestionSchema` for Test mode. Those are Phase 2 — do not port them yet.

- [ ] **Step 4: Create `apps/web/src/lib/quiz.ts`** (the schema + types only — **drop** `isQuizRequest`, `QUIZ_TRIGGER_PATTERNS`, `QUIZ_SYSTEM_INSTRUCTION` from #313):

```ts
import { z } from "zod";
import { mcQuestionSchema, type MCQuestion } from "@/lib/questions";

/**
 * A multiple-choice quiz rendered as an interactive widget. Used as the
 * `inputSchema` of the `showQuiz` tool, so the model fills this in directly.
 */
export const quizSchema = z.object({
  quiz_title: z.string().min(1),
  questions: z.array(mcQuestionSchema).min(1).max(5),
});

export type QuizQuestion = MCQuestion;
export type Quiz = z.infer<typeof quizSchema>;
```

- [ ] **Step 5: Run the test to verify it passes.**

```bash
cd apps/web && npx jest src/__tests__/lib/quiz.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit.**

```bash
git add apps/web/src/lib/questions.ts apps/web/src/lib/quiz.ts apps/web/src/__tests__/lib/quiz.test.ts
git commit -m "feat(chat): add quiz schema for study-tool input"
```

---

## Task 3: The `studyTools` tool map + system addendum

**Files:**
- Create: `apps/web/src/server/chat/study-tools.ts`
- Test: `apps/web/src/__tests__/server/chat/study-tools.test.ts`

**Interfaces:**
- Consumes: `quizSchema` (Task 2).
- Produces: `studyTools` (a `ToolSet` with `showQuiz`), `STUDY_TOOLS_SYSTEM_ADDENDUM` (string), `type StudyUIMessage` (a `UIMessage` typed with the study tools + metadata).

- [ ] **Step 1: Write the failing test.** Create `apps/web/src/__tests__/server/chat/study-tools.test.ts`:

```ts
import { describe, it, expect } from "@jest/globals";
import { studyTools } from "@/server/chat/study-tools";

describe("studyTools", () => {
  it("registers showQuiz with the quiz schema and no execute", () => {
    expect(studyTools.showQuiz).toBeDefined();
    expect(studyTools.showQuiz.inputSchema).toBeDefined();
    // Render-only tool: no server-side execute.
    expect(studyTools.showQuiz.execute).toBeUndefined();
  });

  it("showQuiz inputSchema validates a quiz payload", () => {
    const parsed = studyTools.showQuiz.inputSchema.safeParse({
      quiz_title: "T",
      questions: [
        { question: "Q?", options: ["A", "B"], correct_answer: "A", explanation: "x" },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

```bash
cd apps/web && npx jest src/__tests__/server/chat/study-tools.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/web/src/server/chat/study-tools.ts`:**

```ts
import { tool } from "ai";
import type { UIMessage, InferUITools, UIDataTypes } from "ai";
import { quizSchema } from "@/lib/quiz";

/**
 * Render-only study tools. Each tool's `inputSchema` IS the widget payload;
 * omitting `execute` means the model's tool call resolves to an
 * `input-available` part that the client renders directly — no server
 * execution, no tool-result round-trip, and the run ends after the call.
 *
 * Phase 1 ships `showQuiz`; flashcards/test/mindmap/matching follow in Phase 2.
 */
export const studyTools = {
  showQuiz: tool({
    description:
      "Render an interactive multiple-choice quiz. Call this when the student " +
      "asks to be quizzed or tested informally on a topic. Base questions on " +
      "the provided course material when available.",
    inputSchema: quizSchema,
  }),
} as const;

/** Appended to the chatbot's system prompt so the model knows the tools exist. */
export const STUDY_TOOLS_SYSTEM_ADDENDUM = `

You can render interactive study tools. When the student asks to be quizzed on a topic, call the \`showQuiz\` tool and fill it with well-formed questions based on the course material above — do not write the quiz out as prose. If the student is only asking a question, answer normally without calling a tool.`;

export type StudyTools = InferUITools<typeof studyTools>;

/** Custom per-message metadata streamed via `toUIMessageStreamResponse`. */
export type StudyMessageMetadata = {
  sources?: Array<{ fileName: string; chunkIndex: number; similarity: number }>;
  responseTime?: number;
  truncated?: boolean;
};

/** A UIMessage typed with our tools — makes `part.input` typed as `Quiz`. */
export type StudyUIMessage = UIMessage<StudyMessageMetadata, UIDataTypes, StudyTools>;
```

- [ ] **Step 4: Run to verify it passes.**

```bash
cd apps/web && npx jest src/__tests__/server/chat/study-tools.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/server/chat/study-tools.ts apps/web/src/__tests__/server/chat/study-tools.test.ts
git commit -m "feat(chat): register showQuiz study tool"
```

---

## Task 4: Widen `metadata` type + UIMessage mapping helpers

**Files:**
- Modify: `packages/db/src/schema.ts` (the `messages.metadata` `.$type<>()` block, ~line 320)
- Create: `apps/web/src/server/chat/ui-messages.ts`
- Test: `apps/web/src/__tests__/server/chat/ui-messages.test.ts`

**Interfaces:**
- Consumes: `StudyUIMessage` (Task 3).
- Produces:
  - `rowToUIMessage(row: { id: string; role: string; content: string; metadata: unknown }): StudyUIMessage`
  - `extractText(parts: StudyUIMessage["parts"]): string`
  - `assistantMessageForDb(msg: StudyUIMessage): { content: string; parts: StudyUIMessage["parts"] }`

- [ ] **Step 1: Widen the DB metadata type** (compile-time only — **no migration**). In `packages/db/src/schema.ts`, change the `messages.metadata` generic to add two fields. Keep `parts` as `unknown[]` so `packages/db` stays free of app/`ai` imports:

```ts
    metadata: jsonb("metadata")
      .$type<{
        sources?: Array<{
          fileName: string;
          chunkIndex: number;
          similarity: number;
        }>;
        responseTime?: number;
        model?: string;
        ragUsed?: boolean;
        // Structured study-tool payloads: the assistant UIMessage `parts`
        // (incl. tool-call parts). Typed `unknown[]` here because this package
        // must not import app code or the `ai` package; the app casts to
        // UIMessagePart[] when rehydrating.
        parts?: unknown[];
        truncated?: boolean;
      }>()
      .default({}),
```

- [ ] **Step 2: Confirm no migration is generated.**

```bash
npm run db:generate
```

Expected: "No schema changes, nothing to migrate" (or no new migration file). If a migration is produced, the change was not type-only — revert and investigate.

- [ ] **Step 3: Write the failing test.** Create `apps/web/src/__tests__/server/chat/ui-messages.test.ts`:

```ts
import { describe, it, expect } from "@jest/globals";
import {
  rowToUIMessage,
  extractText,
  assistantMessageForDb,
} from "@/server/chat/ui-messages";

describe("rowToUIMessage", () => {
  it("rehydrates a legacy text row (no parts) into a single text part", () => {
    const msg = rowToUIMessage({
      id: "m1",
      role: "assistant",
      content: "Hello there",
      metadata: {},
    });
    expect(msg.role).toBe("assistant");
    expect(msg.parts).toEqual([{ type: "text", text: "Hello there" }]);
  });

  it("rehydrates a tool message from metadata.parts", () => {
    const parts = [
      { type: "text", text: "Here is a quiz:" },
      {
        type: "tool-showQuiz",
        toolCallId: "c1",
        state: "input-available",
        input: { quiz_title: "T", questions: [] },
      },
    ];
    const msg = rowToUIMessage({
      id: "m2",
      role: "assistant",
      content: "Here is a quiz:",
      metadata: { parts },
    });
    expect(msg.parts).toEqual(parts);
  });
});

describe("extractText", () => {
  it("joins only text parts", () => {
    expect(
      extractText([
        { type: "text", text: "a" },
        { type: "tool-showQuiz", toolCallId: "c", state: "input-available", input: {} },
        { type: "text", text: "b" },
      ] as never),
    ).toBe("a\nb");
  });
});

describe("assistantMessageForDb", () => {
  it("returns joined text as content and the full parts array", () => {
    const out = assistantMessageForDb({
      id: "m3",
      role: "assistant",
      parts: [
        { type: "text", text: "hi" },
        { type: "tool-showQuiz", toolCallId: "c", state: "input-available", input: {} },
      ],
    } as never);
    expect(out.content).toBe("hi");
    expect(out.parts).toHaveLength(2);
  });
});
```

- [ ] **Step 4: Run to verify it fails.**

```bash
cd apps/web && npx jest src/__tests__/server/chat/ui-messages.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5: Create `apps/web/src/server/chat/ui-messages.ts`:**

```ts
import type { StudyUIMessage } from "./study-tools";

type MessageRow = {
  id: string;
  role: string;
  content: string;
  metadata: unknown;
};

/** Concatenate the text of all `text` parts (newline-joined). */
export function extractText(parts: StudyUIMessage["parts"]): string {
  return parts
    .filter((p): p is Extract<StudyUIMessage["parts"][number], { type: "text" }> =>
      p.type === "text",
    )
    .map((p) => p.text)
    .join("\n");
}

/**
 * Rehydrate a DB message row into a UIMessage. Tool messages restore their
 * `parts` from `metadata.parts`; legacy text rows fall back to a single text
 * part built from `content`.
 */
export function rowToUIMessage(row: MessageRow): StudyUIMessage {
  const metadata = (row.metadata ?? {}) as {
    parts?: unknown[];
    sources?: StudyUIMessage["metadata"] extends infer M
      ? M extends { sources?: infer S }
        ? S
        : never
      : never;
  };
  const parts = (metadata.parts as StudyUIMessage["parts"] | undefined) ?? [
    { type: "text", text: row.content },
  ];
  return {
    id: row.id,
    role: row.role as StudyUIMessage["role"],
    parts,
  };
}

/** Split a generated assistant UIMessage into the `content` + `parts` we store. */
export function assistantMessageForDb(msg: StudyUIMessage): {
  content: string;
  parts: StudyUIMessage["parts"];
} {
  return { content: extractText(msg.parts), parts: msg.parts };
}
```

- [ ] **Step 6: Run to verify it passes, then full type-check.**

```bash
cd apps/web && npx jest src/__tests__/server/chat/ui-messages.test.ts
npm run check-types
```

Expected: tests PASS; check-types PASS.

- [ ] **Step 7: Commit.**

```bash
git add packages/db/src/schema.ts apps/web/src/server/chat/ui-messages.ts apps/web/src/__tests__/server/chat/ui-messages.test.ts
git commit -m "feat(chat): persist and rehydrate study-tool message parts in metadata"
```

---

## Task 5: The shared `streamChat` orchestrator

**Files:**
- Create: `apps/web/src/server/chat/stream-chat.ts`

**Interfaces:**
- Consumes: `studyTools`, `STUDY_TOOLS_SYSTEM_ADDENDUM`, `StudyUIMessage`, `StudyMessageMetadata` (Task 3); `rowToUIMessage`, `assistantMessageForDb`, `extractText` (Task 4); `OpenRouterClient.getModel` (Task 1); existing `buildRAGContext`, `resolveModel`, `MODEL_REGISTRY`, `calculateChunkLimit`, `allocateTokenBudget`, `CHARS_PER_TOKEN` from `@teachanything/ai`.
- Produces:
  ```ts
  function streamChat(params: {
    chatbot: typeof chatbots.$inferSelect;
    userMessage: StudyUIMessage;   // the new message from the client
    sessionId: string;
    db: typeof DbType;
    eventType: "message_sent" | "shared_message_sent";
  }): Promise<Response>
  ```

> **Verification note:** `streamChat` orchestrates external services (DB, RAG embeddings, the LLM). Per AGENTS.md §12 we unit-test the pure pieces (Tasks 2–4) and verify this orchestrator by **running the app** (Task 10). No unit test here.

- [ ] **Step 1: Create `apps/web/src/server/chat/stream-chat.ts`.** This ports the body of `processMessage` from `apps/web/src/server/routers/chat.ts:71-379`, replacing the hand-driven `fullStream` loop with `streamText({ tools }).toUIMessageStreamResponse(...)`:

```ts
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { getEncoding } from "js-tiktoken";
import {
  createOpenRouterClient,
  resolveModel,
  MODEL_REGISTRY,
  calculateChunkLimit,
  allocateTokenBudget,
  CHARS_PER_TOKEN,
} from "@teachanything/ai";
import {
  chatbots,
  conversations,
  messages,
  analytics,
} from "@teachanything/db/schema";
import type { db as DbType } from "@teachanything/db";
import { buildRAGContext } from "@/server/rag-context";
import { env } from "@/lib/env";
import { logInfo, logError, logWarn } from "@/lib/logger";
import {
  studyTools,
  STUDY_TOOLS_SYSTEM_ADDENDUM,
  type StudyUIMessage,
  type StudyMessageMetadata,
} from "./study-tools";
import { rowToUIMessage, assistantMessageForDb, extractText } from "./ui-messages";

// Cached tiktoken counter (mirrors chat.ts).
let counterPromise: Promise<(text: string) => number> | null = null;
async function initTokenCounter(): Promise<(text: string) => number> {
  if (!counterPromise) {
    counterPromise = (async () => {
      try {
        const encoder = getEncoding("o200k_base");
        return (text: string) => encoder.encode(text).length;
      } catch {
        logWarn("Failed to init tiktoken, using char/4 fallback");
        return (text: string) => Math.ceil(text.length / CHARS_PER_TOKEN);
      }
    })();
  }
  return counterPromise;
}

function clampMaxTokens(maxTokens: number | null | undefined): number {
  const DEFAULT = 2000;
  if (maxTokens == null || isNaN(maxTokens)) return DEFAULT;
  return Math.max(100, Math.min(4000, maxTokens));
}

export async function streamChat(params: {
  chatbot: typeof chatbots.$inferSelect;
  userMessage: StudyUIMessage;
  sessionId: string;
  db: typeof DbType;
  eventType: "message_sent" | "shared_message_sent";
}): Promise<Response> {
  const { chatbot, userMessage, sessionId, db: database, eventType } = params;
  const messageText = extractText(userMessage.parts);

  // Get or create the conversation for this session.
  const existing = await database
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.chatbotId, chatbot.id),
        eq(conversations.sessionId, sessionId),
      ),
    )
    .limit(1);
  let conversation = existing[0];
  if (!conversation) {
    const [created] = await database
      .insert(conversations)
      .values({ chatbotId: chatbot.id, sessionId, metadata: {} })
      .returning();
    conversation = created;
  }
  if (!conversation) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create conversation",
    });
  }

  const modelId = resolveModel(chatbot.model);
  const { contextWindow } = MODEL_REGISTRY[modelId];
  const maxOutputTokens = clampMaxTokens(chatbot.maxTokens);
  const countTokens = await initTokenCounter();

  const systemPromptTokens = countTokens(chatbot.systemPrompt);
  const userMessageTokens = countTokens(messageText);
  const estimatedChunkLimit = calculateChunkLimit({
    contextWindow,
    maxOutputTokens,
    systemPromptTokens,
    fileManifestTokens: 0,
    userMessageTokens,
  });

  const aiClient = createOpenRouterClient(
    env.OPENROUTER_API_KEY,
    env.OPENAI_API_KEY,
  );

  // History + RAG in parallel (mirrors chat.ts).
  const [historyRows, ragResult] = await Promise.all([
    database
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(desc(messages.createdAt))
      .limit(50),
    buildRAGContext({
      chatbotId: chatbot.id,
      message: messageText,
      db: database,
      openrouterApiKey: env.OPENROUTER_API_KEY,
      openaiApiKey: env.OPENAI_API_KEY,
      chunkLimit: estimatedChunkLimit,
      aiClient,
    }),
  ]);
  historyRows.reverse();

  const fileManifestTokens = countTokens(ragResult.fileManifest);
  const ragContextTokens = countTokens(ragResult.contextText);
  const ragFailureNoteTokens = countTokens(ragResult.ragFailureNote);

  const budget = allocateTokenBudget({
    contextWindow,
    maxOutputTokens,
    systemPromptTokens: systemPromptTokens + ragFailureNoteTokens,
    fileManifestTokens: fileManifestTokens + ragContextTokens,
    userMessageTokens,
    availableChunks: [],
    availableHistory: historyRows.map((m) => ({
      tokens: Math.ceil(m.content.length / CHARS_PER_TOKEN),
    })),
  });
  for (const warning of budget.warnings) {
    logWarn(warning, { chatbotId: chatbot.id, modelId });
  }
  const trimmedHistory =
    budget.historyLimit > 0
      ? historyRows.slice(historyRows.length - budget.historyLimit)
      : [];

  const systemPrompt =
    ragResult.ragFailureNote +
    chatbot.systemPrompt +
    ragResult.fileManifest +
    ragResult.contextText +
    STUDY_TOOLS_SYSTEM_ADDENDUM;

  // History rows -> UIMessages -> ModelMessages, then append the new message.
  const historyUiMessages = trimmedHistory.map(rowToUIMessage);
  const uiMessages: StudyUIMessage[] = [...historyUiMessages, userMessage];
  const modelMessages = await convertToModelMessages(uiMessages, {
    tools: studyTools,
    ignoreIncompleteToolCalls: true,
  });

  // Persist the user message up front (parallel; awaited in onFinish).
  const userInsert = database
    .insert(messages)
    .values({
      conversationId: conversation.id,
      role: "user",
      content: messageText,
      metadata: { parts: userMessage.parts },
    })
    .catch((err) => {
      logError(err, "Failed to insert user message", {
        chatbotId: chatbot.id,
        sessionId,
      });
      throw err;
    });

  const startTime = Date.now();

  const result = streamText({
    model: aiClient.getModel(modelId),
    system: systemPrompt,
    messages: modelMessages,
    tools: studyTools,
    stopWhen: stepCountIs(5),
    temperature: (chatbot.temperature ?? 70) / 100,
    maxOutputTokens,
  });

  return result.toUIMessageStreamResponse<StudyUIMessage>({
    originalMessages: uiMessages,
    sendReasoning: false, // never leak reasoning text (public bots)
    messageMetadata: ({ part }): StudyMessageMetadata | undefined => {
      if (part.type === "finish") {
        return {
          sources: ragResult.sources,
          responseTime: Date.now() - startTime,
          truncated: part.finishReason === "length" || undefined,
        };
      }
      return undefined;
    },
    onError: (error) => {
      logError(error, "stream error in streamChat", { chatbotId: chatbot.id });
      return "Failed to generate a response. Please try again.";
    },
    onFinish: async ({ responseMessage }) => {
      const responseTime = Date.now() - startTime;
      const truncated = responseMessage.parts.some(
        (p) => p.type === "text" && p.state === "done",
      )
        ? undefined
        : undefined; // truncation surfaced via metadata; not re-derived here
      const { content, parts } = assistantMessageForDb(responseMessage);

      try {
        await userInsert;
        await database.insert(messages).values({
          conversationId: conversation.id,
          role: "assistant",
          content,
          metadata: {
            parts,
            sources: ragResult.sources,
            responseTime,
            ragUsed: ragResult.ragUsed,
            truncated,
          },
        });

        const ragSimilarityScore =
          ragResult.sources.length > 0
            ? Math.max(...ragResult.sources.map((s) => s.similarity))
            : undefined;
        await database.insert(analytics).values({
          chatbotId: chatbot.id,
          eventType,
          eventData: {
            sessionId,
            responseTime,
            messageLength: messageText.length,
            responseLength: content.length,
            ragUsed: ragResult.ragUsed,
            ragSimilarityScore,
            sourcesCount: ragResult.sources.length,
            question: messageText.slice(0, 500),
          },
          sessionId,
        });
        logInfo("Chat message processed", {
          chatbotId: chatbot.id,
          sessionId,
          responseTime,
          eventType,
        });
      } catch (err) {
        logError(err, "Failed to persist assistant message", {
          chatbotId: chatbot.id,
          sessionId,
        });
      }
    },
  });
}

/** Generate a fresh session id (client-compatible: alnum, length 21). */
export function newSessionId(): string {
  return nanoid();
}
```

> The dangling `truncated` re-derivation in `onFinish` is intentionally left `undefined` there — truncation is carried to the client via `messageMetadata` (the `finish` part). Drop the unused local if your linter flags it; it is shown here only to document why we don't recompute it.

- [ ] **Step 2: Type-check.**

```bash
npm run check-types
```

Expected: PASS. (If `js-tiktoken`'s `getEncoding` import differs from the dynamic import in `chat.ts`, match `chat.ts:55` exactly.)

- [ ] **Step 3: Commit.**

```bash
git add apps/web/src/server/chat/stream-chat.ts
git commit -m "feat(chat): add streamChat orchestrator with study tools"
```

---

## Task 6: The two Route Handlers

**Files:**
- Create: `apps/web/src/app/api/chat/route.ts`
- Create: `apps/web/src/app/api/chat/shared/route.ts`

**Interfaces:**
- Consumes: `streamChat`, `newSessionId` (Task 5); `StudyUIMessage` (Task 3); existing `auth` (`@/lib/auth`), rate limiters (`@/lib/rate-limit`), `db` (`@teachanything/db`).
- Request body (both): `{ message: StudyUIMessage; sessionId: string }` plus `chatbotId` (authed) or `shareToken` (public). Returns a UI message stream `Response`.

- [ ] **Step 1: Confirm the session-resolution pattern.** Open `apps/web/src/server/trpc.ts` and copy how it derives the session from request headers (Better Auth). Use the **same** call in the route. The standard form is:

```ts
const session = await auth.api.getSession({ headers: req.headers });
```

- [ ] **Step 2: Create `apps/web/src/app/api/chat/route.ts`** (authenticated):

```ts
import { eq, and } from "drizzle-orm";
import { db } from "@teachanything/db";
import { chatbots } from "@teachanything/db/schema";
import { auth } from "@/lib/auth";
import { logError } from "@/lib/logger";
import {
  checkRateLimit,
  authenticatedChatRateLimit,
} from "@/lib/rate-limit";
import { streamChat, newSessionId } from "@/server/chat/stream-chat";
import type { StudyUIMessage } from "@/server/chat/study-tools";

export const maxDuration = 300; // allow long streams (mirrors prior 5-min cap)

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { success } = await checkRateLimit(
      authenticatedChatRateLimit,
      session.user.id,
    );
    if (!success) {
      return new Response("Too many messages. Please slow down.", { status: 429 });
    }

    const body = (await req.json()) as {
      message: StudyUIMessage;
      sessionId?: string;
      chatbotId: string;
    };

    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, body.chatbotId),
          eq(chatbots.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!chatbot) return new Response("Chatbot not found", { status: 404 });

    return await streamChat({
      chatbot,
      userMessage: body.message,
      sessionId: body.sessionId || newSessionId(),
      db,
      eventType: "message_sent",
    });
  } catch (error) {
    logError(error, "POST /api/chat failed");
    return new Response("Failed to send message", { status: 500 });
  }
}
```

- [ ] **Step 3: Create `apps/web/src/app/api/chat/shared/route.ts`** (public/embed):

```ts
import { eq, and } from "drizzle-orm";
import { db } from "@teachanything/db";
import { chatbots } from "@teachanything/db/schema";
import { logError } from "@/lib/logger";
import { checkRateLimit, publicChatRateLimit } from "@/lib/rate-limit";
import { streamChat, newSessionId } from "@/server/chat/stream-chat";
import type { StudyUIMessage } from "@/server/chat/study-tools";

export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as {
      message: StudyUIMessage;
      sessionId?: string;
      shareToken: string;
    };

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { success } = await checkRateLimit(
      publicChatRateLimit,
      `${body.shareToken}:${clientIp}`,
    );
    if (!success) {
      return new Response("Too many messages. Please slow down.", { status: 429 });
    }

    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.shareToken, body.shareToken),
          eq(chatbots.sharingEnabled, true),
        ),
      )
      .limit(1);
    if (!chatbot) {
      return new Response("Chatbot not found or sharing is disabled", {
        status: 404,
      });
    }

    return await streamChat({
      chatbot,
      userMessage: body.message,
      sessionId: body.sessionId || newSessionId(),
      db,
      eventType: "shared_message_sent",
    });
  } catch (error) {
    logError(error, "POST /api/chat/shared failed");
    return new Response("Failed to send message", { status: 500 });
  }
}
```

- [ ] **Step 4: Type-check.**

```bash
npm run check-types
```

Expected: PASS. (If `auth` is not the default export name in `@/lib/auth`, or `checkRateLimit`'s signature differs, match the existing usage in `apps/web/src/server/routers/chat.ts`.)

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/app/api/chat/route.ts apps/web/src/app/api/chat/shared/route.ts
git commit -m "feat(chat): add /api/chat route handlers for authed and public chat"
```

---

## Task 7: Client hooks — wrap `@ai-sdk/react` `useChat`

**Files:**
- Modify: `apps/web/src/hooks/useChat.ts` (public/share)
- Modify: `apps/web/src/hooks/useChatbot.ts` (authenticated)
- Delete: `apps/web/src/hooks/useChatState.ts`

**Interfaces:**
- Consumes: `StudyUIMessage` (Task 3); `@ai-sdk/react` `useChat`; `ai` `DefaultChatTransport`.
- Produces (both hooks return the same shape, consumed by `ChatInterface` in Task 9):
  ```ts
  {
    messages: StudyUIMessage[];
    currentMessage: string;
    setCurrentMessage: (s: string) => void;
    isStreaming: boolean;       // status === "submitted" || "streaming"
    isThinking: boolean;        // status === "submitted" (awaiting first token)
    sendMessage: (text: string) => boolean; // false if a stream is in flight
    handleSendMessage: (e: React.FormEvent) => void;
    stop: () => void;
    resetChat: () => void;
    messagesEndRef: React.RefObject<HTMLDivElement>;
    chatbot, chatbotLoading, error;
  }
  ```

- [ ] **Step 1: Rewrite `apps/web/src/hooks/useChat.ts`** (public/share-token):

```ts
import { useState, useRef, useEffect, useCallback } from "react";
import { useChat as useAIChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { StudyUIMessage } from "@/server/chat/study-tools";

/**
 * Chat with a shared/public chatbot (share-token pages + embed widget),
 * backed by the AI SDK chat transport hitting POST /api/chat/shared.
 */
export function useChat(shareToken: string) {
  const [sessionId] = useState(() => nanoid());
  const [currentMessage, setCurrentMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    data: chatbot,
    isLoading: chatbotLoading,
    error,
  } = trpc.chatbot.getByShareToken.useQuery(
    { shareToken },
    { retry: false, refetchOnWindowFocus: false },
  );

  const chat = useAIChat<StudyUIMessage>({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: "/api/chat/shared",
      prepareSendMessagesRequest({ messages }) {
        return {
          body: {
            message: messages[messages.length - 1],
            sessionId,
            shareToken,
          },
        };
      },
    }),
    onError: () => toast.error("Failed to send message. Please try again."),
  });

  const isStreaming = chat.status === "submitted" || chat.status === "streaming";
  const isThinking = chat.status === "submitted";

  const sendMessage = useCallback(
    (text: string): boolean => {
      if (!text.trim() || isStreaming) return false;
      void chat.sendMessage({ text });
      return true;
    },
    [chat, isStreaming],
  );

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (sendMessage(currentMessage)) setCurrentMessage("");
  };

  const resetChat = () => {
    chat.setMessages([]);
    setCurrentMessage("");
  };

  // Auto-scroll on new content.
  useEffect(() => {
    const id = setTimeout(() => {
      const el = messagesEndRef.current;
      if (!el) return;
      const container = el.closest("[data-scroll-container]") as HTMLElement | null;
      if (container) container.scrollTop = container.scrollHeight;
      else el.scrollIntoView({ behavior: "instant", block: "end" });
    }, 0);
    return () => clearTimeout(id);
  }, [chat.messages]);

  return {
    messages: chat.messages,
    currentMessage,
    setCurrentMessage,
    isStreaming,
    isThinking,
    sendMessage,
    handleSendMessage,
    stop: chat.stop,
    resetChat,
    messagesEndRef,
    chatbot,
    chatbotLoading,
    error,
  };
}
```

- [ ] **Step 2: Rewrite `apps/web/src/hooks/useChatbot.ts`** (authenticated). Same as Step 1 except: it takes `(chatbotId: string, session)`, queries `trpc.chatbot.get` (matching the current call — confirm the exact procedure name/args from the existing file before editing), the transport `api` is `"/api/chat"`, and the request body sends `chatbotId` instead of `shareToken`:

```ts
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest({ messages }) {
        return {
          body: { message: messages[messages.length - 1], sessionId, chatbotId };
        };
      },
    }),
```

Keep the rest (input state, isStreaming/isThinking, sendMessage, resetChat, auto-scroll) identical. Preserve the current chatbot-fetch query and its `enabled: !!session` gating.

- [ ] **Step 3: Delete the dead state machine.**

```bash
git rm apps/web/src/hooks/useChatState.ts
```

- [ ] **Step 4: Type-check** (will surface every consumer that must change — `ChatInterface` and the pages, handled in Tasks 8–10).

```bash
npm run check-types
```

Expected: errors localized to `ChatInterface.tsx` / pages (fixed next). The hooks themselves compile.

- [ ] **Step 5: Commit** (after Tasks 8–10 make it green — or commit now if you prefer red-then-green across tasks; recommended to commit at Task 10 when the app builds). Skip an isolated commit here.

---

## Task 8: Render `message.parts` in `ChatMessage` + port `QuizMessage`

**Files:**
- Modify: `apps/web/src/components/chat/messages/ChatMessage.tsx`
- Create: `apps/web/src/components/chat/messages/QuizMessage.tsx`

**Interfaces:**
- Consumes: `StudyUIMessage` (Task 3); `Quiz` (`@/lib/quiz`).
- Produces: `ChatMessage({ message: StudyUIMessage; showSources?: boolean })`; `QuizMessage({ quiz: Quiz })`.

- [ ] **Step 1: Port `QuizMessage.tsx` from PR #313** (it is self-contained — internal `useState` for progress/scoring, no callbacks):

```bash
git fetch origin pull/313/head:pr-313 2>/dev/null || true
git show pr-313:apps/web/src/components/chat/messages/QuizMessage.tsx > apps/web/src/components/chat/messages/QuizMessage.tsx
```

Open it and confirm: named export `QuizMessage`, props `{ quiz: Quiz }`, importing `Quiz` from `@/lib/quiz`. No edits should be needed (the schema/types it depends on were ported in Task 2).

- [ ] **Step 2: Rewrite `ChatMessage.tsx` to walk `parts`.** Replace the `message: MessageType` content rendering with a `parts` map. Keep the user/assistant layout, the cancelled/truncated/sources affordances (now read from `message.metadata`), and the copy button. Key shape:

```tsx
import type { StudyUIMessage } from "@/server/chat/study-tools";
import { QuizMessage } from "./QuizMessage";
// ...existing imports (Message, MessageContent, SourceBadge, etc.)

interface ChatMessageProps {
  message: StudyUIMessage;
  showSources?: boolean;
}

export function ChatMessage({ message, showSources = false }: ChatMessageProps) {
  const isUser = message.role === "user";
  const sources = message.metadata?.sources ?? [];
  const truncated = message.metadata?.truncated;
  const uniqueSources = dedupeSourcesByFileName(sources);

  const rendered = message.parts.map((part, i) => {
    switch (part.type) {
      case "text":
        return (
          <MessageContent key={i} markdown={!isUser} className={isUser ? "bg-primary/10 ..." : "bg-secondary"}>
            {part.text}
          </MessageContent>
        );
      case "tool-showQuiz":
        // Render once the model has finished filling the input.
        if (part.state === "input-available" || part.state === "output-available") {
          return <QuizMessage key={part.toolCallId} quiz={part.input} />;
        }
        return null; // input-streaming / errors: nothing (typing indicator covers it)
      default:
        return null; // reasoning, etc. — not rendered
    }
  });

  // ...wrap `rendered` in the existing user vs assistant container markup,
  // appending the truncated badge + sources block (showSources) exactly as today.
}
```

Notes:
- `part.input` is typed as `Quiz` inside the `tool-showQuiz` branch (thanks to `StudyUIMessage`'s `InferUITools`), so **no casts**.
- The copy button's text was `message.content`; derive it from text parts: `message.parts.filter(p => p.type === "text").map(p => p.text).join("\n")`.
- Keep the `StreamingMessage` export deletion for Task 9 (it is no longer used once the live assistant message renders from `messages`).

- [ ] **Step 3: Type-check.**

```bash
npm run check-types
```

Expected: `ChatMessage.tsx` compiles; remaining errors are in `ChatInterface.tsx`/pages.

- [ ] **Step 4: Commit at Task 10** (kept green together).

---

## Task 9: Update `ChatInterface` to consume `UIMessage[]` + `status`

**Files:**
- Modify: `apps/web/src/components/chat/messages/ChatInterface.tsx`

**Interfaces:**
- Consumes: the hook return shape (Task 7); `ChatMessage` (Task 8).
- New props (replacing `streamingContent`): `messages: StudyUIMessage[]`, `isStreaming`, `isThinking`, `currentMessage`, `setCurrentMessage`, `handleSendMessage`, `stop`, `resetChat`, `messagesEndRef`, plus the existing presentational props (`chatbotName`, `height`, `hideHeader`, `embedMode`, `showFrame`, `showSources`, `brandingText`).

- [ ] **Step 1: Replace the message list + streaming block.** Today it maps `messages` → `ChatMessage` and conditionally renders `<StreamingMessage content={streamingContent} .../>`. The AI SDK keeps the in-flight assistant message inside `messages`, so:
  - Map `messages` → `<ChatMessage message={msg} showSources={showSources} />` (the last assistant message streams in place).
  - Drop the `streamingContent` prop and the `<StreamingMessage>` render.
  - Show a typing indicator when `isThinking` (i.e., `status === "submitted"`, before the first token) **and** the last message is not yet an assistant message. Reuse the existing `TypingLoader` markup that lived in `StreamingMessage`'s empty state.
  - `exportChatAsText` currently takes `ChatMessage[]` with `.content`; update its input mapping to derive text from `msg.parts` (text parts joined) — check `apps/web/src/lib/export-chat.ts` and adapt its type, or pre-map in `ChatInterface`.
  - The `ChatInput` block (`currentMessage`, `setCurrentMessage`, `onSendMessage={handleSendMessage}`, `onStopStreaming={stop}`) stays.

- [ ] **Step 2: Remove `StreamingMessage`.** Delete the now-unused `StreamingMessage` export from `ChatMessage.tsx` (added during Task 8 cleanup) and its import in `ChatInterface.tsx`.

- [ ] **Step 3: Type-check.**

```bash
npm run check-types
```

Expected: errors now only in the three pages (Task 10).

---

## Task 10: Wire the pages, remove the dead tRPC subscriptions, verify end-to-end

**Files:**
- Modify: `apps/web/src/app/chat/[shareToken]/page.tsx`
- Modify: `apps/web/src/app/chatbot/[id]/page.tsx`
- Modify: `apps/web/src/app/embed/[shareToken]/window/page.tsx`
- Modify: `apps/web/src/server/routers/chat.ts`

- [ ] **Step 1: Update the three pages.** Each destructures the hook and passes props to `ChatInterface`. Remove `streamingContent` from the destructure/props; add `stop` (was `stopStreaming`). The hosting differences (height, `showFrame`, `hideHeader`, `embedMode`, `brandingText`, `showSources`) are unchanged. Example for `chat/[shareToken]/page.tsx`:

```tsx
const {
  messages, currentMessage, setCurrentMessage, isStreaming, isThinking,
  handleSendMessage, stop, resetChat, messagesEndRef, chatbot, chatbotLoading, error,
} = useChat(shareToken);
// ...pass into <ChatInterface ... stop={stop} /> (no streamingContent)
```

- [ ] **Step 2: Remove the dead streaming subscriptions** from `apps/web/src/server/routers/chat.ts`: delete `sendMessageStream` and `sendSharedMessageStream` (and the now-unused `processMessage` generator + its helpers `clampMaxTokens`, `initTokenCounter`/`counterPromise` if not referenced elsewhere). **Keep** `getHistory` and `deleteConversation`. Remove now-unused imports.

- [ ] **Step 3: Full static checks.**

```bash
npm run check-types && npm run lint
```

Expected: PASS (whole repo green).

- [ ] **Step 4: Run the unit tests.**

```bash
npm run test
```

Expected: PASS, including the new `quiz`, `study-tools`, and `ui-messages` suites.

- [ ] **Step 5: Manual end-to-end verification** (the orchestrator + transport are I/O — verify by running):

```bash
npm run dev
```

Verify, on **all three** entry points (authenticated `/chatbot/[id]`, public `/chat/[shareToken]`, embed `/embed/[shareToken]/window`):
1. A normal question streams a text answer token-by-token (typing indicator before first token).
2. "Quiz me on <a topic in the chatbot's material>" renders an interactive `<QuizMessage>` (not JSON/prose).
3. Reload mid-conversation: a new session starts empty (expected — no cross-reload rehydration this phase).
4. RAG **Sources** still appear under answers when `showSources` is on (proves `messageMetadata` sources round-trip — the line you flagged in the spec).
5. Open the DB (`npm run db:studio`): the assistant row for the quiz has `metadata.parts` containing the `tool-showQuiz` part and `metadata.sources`/`responseTime`; an `analytics` row exists with the right `eventType`.
6. Stop mid-stream works; rate limiting still blocks rapid-fire sends.

- [ ] **Step 6: Commit the whole client migration.**

```bash
git add apps/web/src/hooks/useChat.ts apps/web/src/hooks/useChatbot.ts \
  apps/web/src/components/chat/messages/ChatMessage.tsx \
  apps/web/src/components/chat/messages/QuizMessage.tsx \
  apps/web/src/components/chat/messages/ChatInterface.tsx \
  apps/web/src/app/chat/[shareToken]/page.tsx \
  apps/web/src/app/chatbot/[id]/page.tsx \
  apps/web/src/app/embed/[shareToken]/window/page.tsx \
  apps/web/src/server/routers/chat.ts \
  apps/web/src/lib/export-chat.ts
git rm apps/web/src/hooks/useChatState.ts 2>/dev/null || true
git commit -m "feat(chat): migrate chat to AI SDK transport with quiz study tool"
```

---

## Self-Review

**Spec coverage (Phase-1 scope):**
- §3 no-gate render-only tools → Task 3 (`showQuiz`, no `execute`). ✓
- §4 transport migration (routes + transport, read-paths stay tRPC) → Tasks 6, 7, 10 (only `sendMessageStream`/`sendSharedMessageStream` removed; `getHistory`/`deleteConversation` kept). ✓
- §5 server (tools, routes, `streamChat`, `getModel`, sendReasoning:false) → Tasks 1, 3, 5, 6. ✓
- §5.3 preserved behaviors (sources/responseTime/truncated via `messageMetadata`) → Task 5 + verified Task 10 step 5.4. ✓
- §6 client (`message.parts` render, `useChat` wrappers, typing indicator) → Tasks 7–9. ✓
- §7 persistence/rehydration in `metadata`, no migration → Task 4. ✓
- §8 quiz reuse → Tasks 2, 8 (QuizMessage port). ✓
- **Out of Phase-1 scope (separate follow-up plan):** flashcards, test (+ `onSendText` grading), mind map, matching (§6/§8/§12 phases 2–3). Listed below — **not a silent gap.**

**Placeholder scan:** No "TBD"/"similar to"/"add error handling" — all steps carry concrete code or exact commands. The one explanatory aside (the `truncated` local in `streamChat.onFinish`) is documented, not a placeholder.

**Type consistency:** `StudyUIMessage` flows from Task 3 → 4 → 5 → 6 → 7 → 8. Hook return shape (Task 7) matches `ChatInterface` props (Task 9) and page destructures (Task 10). `rowToUIMessage`/`assistantMessageForDb`/`extractText` names are used consistently in Tasks 4–5. Tool part type is `tool-showQuiz`, state `input-available`, payload `part.input: Quiz` throughout.

## Follow-up: Phase 2 (separate plan)

Once Phase 1 lands and the client API is empirically confirmed, Phase 2 repeats the now-proven pattern per mode and is its own plan:
1. Port `flashcards.ts`, `test-mode.ts` (+ the Test question schemas in `questions.ts`), `mindmap.ts`, `matching.ts`, `matching-game.ts`, `grading.ts` (schemas/helpers only; drop detection/instruction exports).
2. Port the four widgets (`FlashcardMessage`, `TestMessage`, `MindMapMessage`, `MatchingMessage`).
3. Add `showFlashcards` / `showTest` / `showMindMap` / `showMatching` to `studyTools`; extend `STUDY_TOOLS_SYSTEM_ADDENDUM`.
4. Add the four render branches to `ChatMessage`.
5. Wire Test-mode grading: pass `onSendText` (calls the hook's `sendMessage`) from the authenticated page into `<TestMessage>`; open-ended answers are graded via the normal chat stream using `buildOpenAnswerReviewMessage` (`grading.ts`).
