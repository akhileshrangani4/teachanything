/**
 * A failed turn has to tell the client.
 *
 * `createUIMessageStream` synthesises an error part only when its `execute`
 * promise REJECTS. Every `executeTurn` exit that sets `executeErrored` returns
 * normally instead, so if it does not write the part itself the stream ends
 * with no error and no finish chunk and the student's text simply stops.
 *
 * That is exactly what regressed when `forward()` moved inside
 * `runPrimaryTurn`'s try: the throw stopped escaping, so the SDK stopped
 * synthesising the part, and nothing replaced it. These tests pin both halves.
 */
import { jest, describe, it, expect } from "@jest/globals";
import type { UIMessageStreamWriter } from "ai";
import { MockLanguageModelV3, convertArrayToReadableStream } from "ai/test";
import type { StudyUIMessage } from "@/server/chat/study-tools";

// The forwarding-failure test deliberately fails a turn, and logError writes
// through to console regardless of ENABLE_LOGGING. Mock it so an expected
// failure does not look like a broken suite in CI output.
jest.unstable_mockModule("@/lib/logger", () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
}));

const { failTurn } = await import("@/server/chat/turn-execution");
const { runPrimaryTurn } = await import("@/server/chat/primary-turn");
type TurnState = import("@/server/chat/turn-execution").TurnState;

type Writer = UIMessageStreamWriter<StudyUIMessage>;

function emptyState(): TurnState {
  return {
    finalSources: [],
    ragUsedFlag: false,
    responseTime: 0,
    truncated: false,
    executeErrored: false,
  };
}

describe("failTurn", () => {
  it("marks the turn errored and writes an error part", () => {
    const written: unknown[] = [];
    const state = emptyState();
    const onStreamError = jest.fn(() => "Failed to generate a response.");

    failTurn(
      {
        state,
        writer: { write: (part: unknown) => written.push(part) } as Writer,
        onStreamError,
      },
      new Error("transform blew up"),
    );

    expect(state.executeErrored).toBe(true);
    expect(written).toEqual([
      { type: "error", errorText: "Failed to generate a response." },
    ]);
    expect(onStreamError).toHaveBeenCalledTimes(1);
  });

  it("passes the original error to onStreamError so it can be logged", () => {
    const cause = new Error("upstream");
    const onStreamError = jest.fn(() => "x");
    failTurn(
      {
        state: emptyState(),
        writer: { write: () => {} } as Writer,
        onStreamError,
      },
      cause,
    );
    expect(onStreamError).toHaveBeenCalledWith(cause);
  });
});

describe("runPrimaryTurn failure contract", () => {
  const model = () =>
    new MockLanguageModelV3({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "hello" },
          { type: "text-end", id: "t1" },
          {
            type: "finish",
            finishReason: "stop",
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          },
        ]),
      }),
    });

  const args = (writer: Writer) => ({
    aiClient: { getModel: () => model() } as never,
    modelId: "test-model" as never,
    systemPrompt: "s",
    messages: [{ role: "user" as const, content: "hi" }],
    tools: {},
    temperature: 0,
    maxOutputTokens: 64,
    abortSignal: new AbortController().signal,
    chatbotId: "cb1",
    partialQuizInput: new Map<string, string>(),
    modelCanUseTools: false,
    onStreamError: () => "err",
    writer,
  });

  // Resolving rather than rejecting is the whole point of the try placement:
  // the caller sets its terminal state instead of letting the throw escape.
  // But it must hand back the error so the caller can surface it.
  it("resolves ok:false carrying the error when forwarding throws", async () => {
    const boom = new Error("writer exploded");
    const writer = {
      write: () => {
        throw boom;
      },
    } as unknown as Writer;

    const outcome = await runPrimaryTurn(args(writer));

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.error).toBe(boom);
  });

  it("still resolves ok:true for a healthy turn", async () => {
    const written: unknown[] = [];
    const writer = {
      write: (part: unknown) => written.push(part),
    } as unknown as Writer;

    const outcome = await runPrimaryTurn(args(writer));

    expect(outcome.ok).toBe(true);
    expect(outcome.ok === true && outcome.primaryText).toBe("hello");
    expect(written.length).toBeGreaterThan(0);
  });
});
