import { jest, describe, it, expect } from "@jest/globals";
import type { UIMessageStreamWriter } from "ai";
import { withFirstTextTimer } from "@/server/chat/turn-timing";
import type { StudyUIMessage } from "@/server/chat/study-tools";

type Writer = UIMessageStreamWriter<StudyUIMessage>;
type Part = Parameters<Writer["write"]>[0];

function fakeWriter() {
  const written: Part[] = [];
  const writer: Writer = {
    write: (part) => {
      written.push(part);
    },
    merge: jest.fn(),
    onError: undefined,
  };
  return { writer, written };
}

describe("withFirstTextTimer", () => {
  it("fires once, on the first non-empty text delta", () => {
    const { writer, written } = fakeWriter();
    const onFirstText = jest.fn();
    const timed = withFirstTextTimer(writer, onFirstText);

    timed.write({ type: "start-step" } as Part);
    timed.write({ type: "text-start", id: "t" });
    timed.write({ type: "text-delta", id: "t", delta: "" });
    expect(onFirstText).not.toHaveBeenCalled();

    timed.write({ type: "text-delta", id: "t", delta: "Photo" });
    timed.write({ type: "text-delta", id: "t", delta: "synthesis" });
    expect(onFirstText).toHaveBeenCalledTimes(1);

    // Every part still reaches the real writer, in order.
    expect(written.map((p) => p.type)).toEqual([
      "start-step",
      "text-start",
      "text-delta",
      "text-delta",
      "text-delta",
    ]);
  });

  it("ignores whitespace-only deltas, which are not a visible answer", () => {
    const { writer } = fakeWriter();
    const onFirstText = jest.fn();
    const timed = withFirstTextTimer(writer, onFirstText);

    // A primary step that streams blank lines and then answers nothing; the
    // fallback writes the real text later.
    timed.write({ type: "text-delta", id: "t", delta: "\n\n" });
    timed.write({ type: "text-delta", id: "t", delta: "  " });
    expect(onFirstText).not.toHaveBeenCalled();

    timed.write({ type: "text-delta", id: "fb", delta: "Here is the answer" });
    expect(onFirstText).toHaveBeenCalledTimes(1);
  });

  it("does not fire for a turn with no text (e.g. quiz only)", () => {
    const { writer } = fakeWriter();
    const onFirstText = jest.fn();
    const timed = withFirstTextTimer(writer, onFirstText);

    timed.write({ type: "finish" } as Part);
    expect(onFirstText).not.toHaveBeenCalled();
  });

  it("passes merge and onError through", () => {
    const { writer } = fakeWriter();
    const onError = () => "boom";
    writer.onError = onError;
    const timed = withFirstTextTimer(writer, jest.fn());

    const stream = new ReadableStream<Part>();
    timed.merge(stream);
    expect(writer.merge).toHaveBeenCalledWith(stream);
    expect(timed.onError).toBe(onError);
  });
});

describe("executeTurn timing (real turn, mock model)", () => {
  it("records firstTokenMs from stream start to the first answer text", async () => {
    // Loaded lazily so the logger mock below applies to the turn code.
    jest.unstable_mockModule("@/lib/logger", () => ({
      logError: jest.fn(),
      logWarn: jest.fn(),
      logInfo: jest.fn(),
    }));
    const { MockLanguageModelV3, convertArrayToReadableStream } =
      await import("ai/test");
    const { executeTurn } = await import("@/server/chat/turn-execution");

    const MODEL_DELAY_MS = 60;
    const model = new MockLanguageModelV3({
      doStream: async () => {
        // Simulates the provider's time to first token.
        await new Promise((r) => setTimeout(r, MODEL_DELAY_MS));
        return {
          stream: convertArrayToReadableStream([
            { type: "stream-start", warnings: [] },
            { type: "text-start", id: "t1" },
            { type: "text-delta", id: "t1", delta: "Photosynthesis..." },
            { type: "text-end", id: "t1" },
            {
              type: "finish",
              finishReason: { unified: "stop", raw: "stop" },
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            },
          ]),
        };
      },
    });

    const state = {
      finalSources: [],
      ragUsedFlag: false,
      responseTime: 0,
      truncated: false,
      executeErrored: false,
    } as Parameters<typeof executeTurn>[0]["state"];
    const { writer } = fakeWriter();

    await executeTurn({
      state,
      writer,
      aiClient: { getModel: () => model } as never,
      modelId: "test-model" as never,
      primarySystemPrompt: "s",
      fallbackSystemPrompt: "s",
      modelMessages: [{ role: "user", content: "what is photosynthesis" }],
      tools: {},
      temperature: 0,
      maxOutputTokens: 64,
      abortSignal: new AbortController().signal,
      chatbotId: "cb1",
      modelCanUseTools: false,
      useRetrievalTools: false,
      ragResult: {
        contextText: "",
        sources: [],
        ragUsed: false,
        fileManifest: "",
        ragFailureNote: "",
        fileIds: [],
      },
      toolSources: [],
      toolPassages: [],
      onStreamError: () => "err",
      startTime: Date.now(),
    });

    expect(state.executeErrored).toBe(false);
    expect(state.firstTokenMs).toBeGreaterThanOrEqual(MODEL_DELAY_MS - 5);
    // First text can't arrive after the turn finished.
    expect(state.firstTokenMs).toBeLessThanOrEqual(state.responseTime);
  });
});
