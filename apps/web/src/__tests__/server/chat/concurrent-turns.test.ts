/**
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { TurnArgs } from "@/server/chat/turn-endings";

/**
 * One turn at a time per session (#465), driven through the real shared chat
 * route and the real `streamChat`. The retrieval, prompt, model and
 * persistence stages are stubbed; the session's `activeTurnAt` marker lives in
 * a map behind the same compare-and-set contract as turn-marker.ts.
 */

// The schema module pulls in the db client, which reads these at import time.
// Nothing here opens a connection.
process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const SHARE_TOKEN = "share-token";

/** conversationId -> activeTurnAt marker (null or absent: free). */
const markers = new Map<string, string | null>();
const conversationIdOf = (sessionId: string) => `conv-${sessionId}`;

async function fakeSwap(
  _database: unknown,
  conversationId: string,
  expected: string | null,
  next: string | null,
): Promise<boolean> {
  if ((markers.get(conversationId) ?? null) !== expected) return false;
  markers.set(conversationId, next);
  return true;
}

/** What each history read saw: the session's marker at that moment. */
let historyReads: { conversationId: string; marker: string | null }[];
let contextFailure: Error | null;
/** Runs as the turn's model call; stubbed per test. */
let runTurn: (args: TurnArgs) => Promise<void>;

function writeAnswer(writer: TurnArgs["writer"], text: string) {
  writer.write({ type: "text-start", id: "t" });
  writer.write({ type: "text-delta", id: "t", delta: text });
  writer.write({ type: "text-end", id: "t" });
}

jest.unstable_mockModule("@teachanything/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: "chatbot-1",
              model: "test-model",
              systemPrompt: "Be helpful.",
              maxTokens: 1000,
              temperature: 70,
            },
          ],
        }),
      }),
    }),
  },
}));
jest.unstable_mockModule("@/lib/logger", () => ({
  logError: () => {},
  logWarn: () => {},
  logInfo: () => {},
}));
jest.unstable_mockModule("@/lib/env", () => ({
  env: { NODE_ENV: "test", OPENROUTER_API_KEY: "k", OPENAI_API_KEY: "k" },
}));
jest.unstable_mockModule("@/lib/get-client-ip", () => ({
  getTrustedClientIp: () => "203.0.113.1",
}));
jest.unstable_mockModule("@/server/rate-limit", () => ({
  checkRateLimit: async () => ({ success: true }),
  requireRateLimit: async () => ({ success: true }),
  publicChatRateLimit: null,
  publicChatGlobalRateLimit: null,
}));
jest.unstable_mockModule("@teachanything/ai", () => ({
  createOpenRouterClient: () => ({}),
  resolveModel: () => "test-model",
  MODEL_REGISTRY: { "test-model": { contextWindow: 100_000 } },
  calculateChunkLimit: () => 5,
}));
jest.unstable_mockModule("@teachanything/ai/models", () => ({
  modelSupportsTools: () => false,
}));
jest.unstable_mockModule("@/server/retrieval-tools", () => ({
  createRetrievalTools: () => ({ tools: {}, sources: [], passages: [] }),
}));
jest.unstable_mockModule("@/server/reprocess", () => ({
  maybeEnqueueReprocess: async () => {},
}));
jest.unstable_mockModule("@/server/chat/token-counter", () => ({
  initTokenCounter: async () => (text: string) => text.length,
}));
jest.unstable_mockModule("@/server/chat/conversation-resolution", () => ({
  // Async like the real read, so concurrent requests both read the session
  // before either claims it.
  resolveConversation: async (
    _database: unknown,
    _chatbotId: string,
    sessionId: string,
  ) => {
    await Promise.resolve();
    const id = conversationIdOf(sessionId);
    const activeTurnAt = markers.get(id) ?? undefined;
    return { id, metadata: activeTurnAt ? { activeTurnAt } : {} };
  },
}));
jest.unstable_mockModule("@/server/chat/turn-marker", () => ({
  swapTurnMarker: fakeSwap,
}));
jest.unstable_mockModule("@/server/chat/turn-context", () => ({
  fetchTurnContext: async ({ conversationId }: { conversationId: string }) => {
    historyReads.push({
      conversationId,
      marker: markers.get(conversationId) ?? null,
    });
    if (contextFailure) throw contextFailure;
    return {
      historyRows: [],
      studyResponseRows: [],
      ragResult: { sources: [], ragUsed: false, fileIds: [] },
    };
  },
  groupStudyResponsesByToolCallId: () => new Map(),
  computeTrimmedHistory: () => [],
}));
jest.unstable_mockModule("@/server/chat/prompt-assembly", () => ({
  buildTurnPrompts: ({ userMessage }: { userMessage: unknown }) => ({
    primarySystemPrompt: "Be helpful.",
    fallbackSystemPrompt: "Be helpful.",
    uiMessages: [userMessage],
  }),
  searchedPassageBudget: () => 0,
}));
jest.unstable_mockModule("@/server/chat/turn-execution", () => ({
  executeTurn: (args: TurnArgs) => runTurn(args),
}));
jest.unstable_mockModule("@/server/chat/turn-persistence", () => ({
  beginUserMessageInsert: async () => {},
  persistTurn: async () => {},
}));

const { POST } = await import("@/app/api/chat/shared/route");

/** A turn's model call held open until `finish` resolves it. */
function heldTurn() {
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => (finish = resolve));
  let started!: () => void;
  const running = new Promise<void>((resolve) => (started = resolve));
  const turn = async ({ writer }: TurnArgs) => {
    started();
    await finished;
    writeAnswer(writer, "Photosynthesis turns light into sugar.");
  };
  return { turn, running, finish };
}

function send(sessionId: string, signal?: AbortSignal) {
  return POST(
    new Request("http://test/api/chat/shared", {
      method: "POST",
      body: JSON.stringify({
        shareToken: SHARE_TOKEN,
        sessionId,
        message: { parts: [{ type: "text", text: "What is photosynthesis?" }] },
      }),
      signal,
    }),
  );
}

/** Settle the release that follows the end of a stream. */
async function eventually(check: () => boolean) {
  for (let i = 0; i < 50 && !check(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  expect(check()).toBe(true);
}

const SESSION = "session-aaaaaaaaaa";
const OTHER_SESSION = "session-bbbbbbbbbb";
const isFree = (sessionId: string) =>
  (markers.get(conversationIdOf(sessionId)) ?? null) === null;

beforeEach(() => {
  markers.clear();
  historyReads = [];
  contextFailure = null;
  runTurn = async ({ writer }) => writeAnswer(writer, "An answer.");
});

describe("concurrent turns on one session", () => {
  it("streams one of two concurrent POSTs and refuses the other with 409", async () => {
    const held = heldTurn();
    runTurn = held.turn;

    const responses = await Promise.all([send(SESSION), send(SESSION)]);

    const statuses = responses.map((res) => res.status).sort();
    expect(statuses).toEqual([200, 409]);
    const refused = responses.find((res) => res.status === 409)!;
    await expect(refused.json()).resolves.toEqual({ code: "turn_in_progress" });

    // Only the winner read history, and only once its claim was in place.
    expect(historyReads).toHaveLength(1);
    expect(historyReads[0]!.marker).not.toBeNull();

    held.finish();
    const streamed = responses.find((res) => res.status === 200)!;
    expect(await streamed.text()).toContain("Photosynthesis");
  });

  it("refuses a turn sent while another is streaming", async () => {
    const held = heldTurn();
    runTurn = held.turn;
    const first = await send(SESSION);
    await held.running;

    const second = await send(SESSION);

    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toEqual({ code: "turn_in_progress" });
    held.finish();
    await first.text();
  });

  it("doesn't let different sessions block each other", async () => {
    const held = heldTurn();
    runTurn = held.turn;
    const first = await send(SESSION);
    await held.running;

    const other = await send(OTHER_SESSION);

    expect(other.status).toBe(200);
    held.finish();
    await Promise.all([first.text(), other.text()]);
  });

  it("takes over a session whose marker outlived the lease", async () => {
    const crashedAt = new Date(Date.now() - 301_000).toISOString();
    markers.set(conversationIdOf(SESSION), crashedAt);

    const res = await send(SESSION);

    expect(res.status).toBe(200);
    await res.text();
  });
});

describe("releasing the session", () => {
  it("frees it when the turn finishes", async () => {
    const res = await send(SESSION);
    expect(await res.text()).toContain("An answer.");

    await eventually(() => isFree(SESSION));
    expect((await send(SESSION)).status).toBe(200);
  });

  it("frees it when the model errors", async () => {
    runTurn = async () => {
      throw new Error("provider unavailable");
    };

    const res = await send(SESSION);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Failed to generate a response");

    await eventually(() => isFree(SESSION));
  });

  it("frees it as soon as the client aborts, so Stop and resend works", async () => {
    const held = heldTurn();
    runTurn = held.turn;
    const controller = new AbortController();
    const first = await send(SESSION, controller.signal);
    await held.running;

    controller.abort();
    await eventually(() => isFree(SESSION));

    const resend = heldTurn();
    runTurn = resend.turn;
    const resent = await send(SESSION);
    expect(resent.status).toBe(200);
    await resend.running;

    // The aborted turn winding down later must not free the resent turn.
    held.finish();
    await first.body?.cancel();
    expect(isFree(SESSION)).toBe(false);

    resend.finish();
    await resent.text();
    await eventually(() => isFree(SESSION));
  });

  it("frees it when the turn throws before streaming", async () => {
    contextFailure = new Error("database unavailable");

    const res = await send(SESSION);

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ code: "send_failed" });
    expect(isFree(SESSION)).toBe(true);
  });
});
