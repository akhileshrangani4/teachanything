/**
 * @jest-environment node
 *
 * The assistant message a student sees must be the row the server persists:
 * a rating (or anything else keyed by message id) is submitted with the id the
 * client received in the stream's `start` chunk, and has to resolve to the
 * `messages` row. Runs the real AI SDK stream and the real `persistTurn`; only
 * the database is faked.
 */
import { jest, describe, it, expect } from "@jest/globals";
import type { InferUIMessageChunk } from "ai";
import type { StudyUIMessage } from "@/server/chat/study-tools";

jest.unstable_mockModule("@/lib/logger", () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
}));

const { createAssistantMessageStream } =
  await import("@/server/chat/assistant-message-stream");
const { persistTurn } = await import("@/server/chat/turn-persistence");
const { messages } = await import("@teachanything/db/schema");

type PersistArgs = Parameters<typeof persistTurn>[0];
type Chunk = InferUIMessageChunk<StudyUIMessage>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function fakeDatabase() {
  const inserts: Array<{ table: unknown; values: Record<string, unknown> }> =
    [];
  const database = {
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        inserts.push({ table, values });
        return Promise.resolve();
      },
    }),
  } as unknown as PersistArgs["database"];
  return { database, inserts };
}

async function readAll(stream: ReadableStream<Chunk>): Promise<Chunk[]> {
  const chunks: Chunk[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return chunks;
    chunks.push(value);
  }
}

/** One streamed turn, persisted the way streamChat's onFinish does it. */
async function streamAndPersistTurn() {
  const { database, inserts } = fakeDatabase();
  let persisted: Promise<void> = Promise.resolve();
  const userMessage: StudyUIMessage = {
    id: "user-1",
    role: "user",
    parts: [{ type: "text", text: "what is photosynthesis" }],
  };

  const stream = createAssistantMessageStream({
    originalMessages: [userMessage],
    execute: ({ writer }) => {
      // Like the primary turn's toUIMessageStream: a start chunk with no id
      // of its own, so the SDK stamps the generated one onto it.
      writer.write({ type: "start" });
      writer.write({ type: "text-start", id: "t1" });
      writer.write({ type: "text-delta", id: "t1", delta: "Light to sugar." });
      writer.write({ type: "text-end", id: "t1" });
      writer.write({ type: "finish" });
    },
    onFinish: ({ responseMessage }) => {
      persisted = persistTurn({
        responseMessage,
        database,
        conversationId: "c1",
        chatbotId: "b1",
        sessionId: "s1",
        eventType: "shared_message_sent",
        messageText: "what is photosynthesis",
        userMessageInsert: {
          promise: Promise.resolve(),
          state: { failed: false },
        },
        timedOut: false,
        clientAborted: false,
        executeErrored: false,
        finalSources: [],
        ragUsedFlag: false,
        truncated: false,
        responseTime: 10,
        startTime: Date.now() - 10,
        modelId: "openai/gpt-oss-120b",
        timing: { preStreamMs: 1, contextMs: 1 },
      });
    },
  });

  const chunks = await readAll(stream);
  await persisted;
  const start = chunks.find((c) => c.type === "start");
  const row = inserts.find((i) => i.table === messages);
  return { streamedId: start?.messageId, persistedId: row?.values.id };
}

describe("assistant message id", () => {
  it("persists the assistant row with the id the client was streamed", async () => {
    const { streamedId, persistedId } = await streamAndPersistTurn();

    expect(streamedId).toEqual(expect.any(String));
    expect(persistedId).toBe(streamedId);
  });

  it("is a UUID, so it fits the messages.id column", async () => {
    const { streamedId } = await streamAndPersistTurn();

    expect(streamedId).toMatch(UUID_RE);
  });

  it("is new for every turn", async () => {
    const first = await streamAndPersistTurn();
    const second = await streamAndPersistTurn();

    expect(first.streamedId).not.toBe(second.streamedId);
  });
});
