/**
 * persistTurn writes the assistant message row. The model id matters because
 * `messages.metadata.model` was declared but never written, so every latency
 * question ("is Maverick the slow one?") was unanswerable from the data.
 */
import { jest, describe, it, expect } from "@jest/globals";
import type { StudyUIMessage } from "@/server/chat/study-tools";

jest.unstable_mockModule("@/lib/logger", () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
}));

const { persistTurn } = await import("@/server/chat/turn-persistence");
const { messages, analytics } = await import("@teachanything/db/schema");
type PersistArgs = Parameters<typeof persistTurn>[0];

/** Fake db that records every insert as { table, values }. */
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

function args(overrides: Partial<PersistArgs> = {}): PersistArgs {
  const responseMessage = {
    id: "m1",
    role: "assistant",
    parts: [{ type: "text", text: "Photosynthesis turns light into sugar." }],
  } as StudyUIMessage;
  return {
    responseMessage,
    database: fakeDatabase().database,
    conversationId: "c1",
    chatbotId: "b1",
    sessionId: "s1",
    eventType: "message_sent",
    messageText: "what is photosynthesis",
    userMessageInsert: { promise: Promise.resolve(), state: { failed: false } },
    timedOut: false,
    clientAborted: false,
    executeErrored: false,
    finalSources: [],
    ragUsedFlag: true,
    truncated: false,
    responseTime: 4200,
    startTime: Date.now() - 4200,
    modelId: "openai/gpt-oss-120b",
    ...overrides,
  };
}

describe("persistTurn", () => {
  it("records the model that answered on the assistant message", async () => {
    const { database, inserts } = fakeDatabase();
    await persistTurn(args({ database }));

    const message = inserts.find((i) => i.table === messages);
    expect(message?.values.role).toBe("assistant");
    expect(message?.values.metadata).toEqual(
      expect.objectContaining({
        model: "openai/gpt-oss-120b",
        responseTime: 4200,
        ragUsed: true,
      }),
    );
  });

  it("records the model on interrupted turns too", async () => {
    const { database, inserts } = fakeDatabase();
    await persistTurn(args({ database, timedOut: true }));

    const message = inserts.find((i) => i.table === messages);
    expect(message?.values.metadata).toEqual(
      expect.objectContaining({
        model: "openai/gpt-oss-120b",
        interrupted: true,
      }),
    );
    // Interrupted turns are not counted in analytics.
    expect(inserts.some((i) => i.table === analytics)).toBe(false);
  });
});
