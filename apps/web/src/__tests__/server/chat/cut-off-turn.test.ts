/**
 * A turn the agentic loop cut off mid-search must still answer the student.
 *
 * Models often write a line before calling a tool ("Let me search more
 * specifically for..."). When the loop then ended before the model read its
 * last search -- the step cap, or a provider failure on a later step -- that
 * line counted as the answer, no fallback ran, and the student got nothing
 * else. On a failure the browser also stopped reading at the error chunk, so
 * the sources never arrived either. A professor's export showed exactly that,
 * four turns running, until she told the bot to stop searching.
 *
 * The other half matters as much: a turn that DID answer must not get a second,
 * fallback answer stacked under it just because something failed nearby.
 *
 * These run the real `executeTurn` over the real AI SDK with a scripted model.
 * `cutOffMidSearch` and `finalStepSettings` are unit-tested in
 * final-step.test.ts.
 */
import { jest, describe, it, expect } from "@jest/globals";
import { createUIMessageStream, tool, type InferUIMessageChunk } from "ai";
import { MockLanguageModelV3, convertArrayToReadableStream } from "ai/test";
import { z } from "zod";

jest.unstable_mockModule("@/lib/logger", () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
}));

const { executeTurn } = await import("@/server/chat/turn-execution");
const { MAX_AGENT_STEPS } = await import("@/server/chat/final-step");
const { studyTools } = await import("@/server/chat/study-tools");
type StudyUIMessage = import("@/server/chat/study-tools").StudyUIMessage;
type TurnState = import("@/server/chat/turn-execution").TurnState;
type Chunk = InferUIMessageChunk<StudyUIMessage>;

type Step =
  | {
      text?: string;
      /** Emit a provider `error` chunk after the text. */
      errorChunk?: boolean;
      /** Shorthand for a `search_documents` call with this query. */
      search?: string;
      call?: { name: string; args: unknown };
      finish: string;
    }
  | { providerFails: true };

const PRIMARY_SYSTEM = "primary system prompt";
const FALLBACK_SYSTEM = "fallback system prompt";
const NARRATION = "Let me search more specifically for unit of analysis.";
const FALLBACK_ANSWER = "Fallback answer from the passages.";
const RAG_SOURCES = [
  { fileName: "Gordis Chapter 3.pdf", chunkIndex: 4, similarity: 0.35 },
];

/** Replays `script` one step per model call, then stops cleanly. */
function scriptedModel(script: Step[]) {
  const scripted = new MockLanguageModelV3({
    doStream: async () => {
      // The mock records each call before running it.
      const n = scripted.doStreamCalls.length;
      const step = script[n - 1] ?? { finish: "stop" };
      if ("providerFails" in step) throw new Error("Provider returned error");
      const id = `s${n}`;
      const parts: unknown[] = [{ type: "stream-start", warnings: [] }];
      if (step.text) {
        parts.push({ type: "text-start", id });
        parts.push({ type: "text-delta", id, delta: step.text });
        parts.push({ type: "text-end", id });
      }
      if (step.errorChunk) {
        parts.push({ type: "error", error: new Error("upstream error") });
      }
      const call =
        step.call ??
        (step.search === undefined
          ? undefined
          : { name: "search_documents", args: { query: step.search } });
      if (call) {
        parts.push({
          type: "tool-call",
          toolCallId: `c-${id}`,
          toolName: call.name,
          input: JSON.stringify(call.args),
        });
      }
      parts.push({
        type: "finish",
        finishReason: { unified: step.finish, raw: step.finish },
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      return { stream: convertArrayToReadableStream(parts as never) };
    },
  });
  return scripted;
}

const retrievalTools = {
  search_documents: tool({
    description: "search",
    inputSchema: z.object({ query: z.string() }),
    execute: async () => [{ content: "a passage" }],
  }),
};

/** Four searches that each end in a tool call, filling every step but the last. */
const SEARCHES_UNTIL_LAST_STEP: Step[] = [
  { text: NARRATION, search: "unit of analysis", finish: "tool-calls" },
  { search: "unit of analysis definition", finish: "tool-calls" },
  { search: "level of analysis", finish: "tool-calls" },
  { search: "ecological studies", finish: "tool-calls" },
];

async function runTurn(
  script: Step[],
  options: { modelCanUseTools?: boolean } = {},
) {
  const modelCanUseTools = options.modelCanUseTools ?? true;
  const model = scriptedModel(script);
  const state: TurnState = {
    finalSources: [],
    ragUsedFlag: false,
    responseTime: 0,
    truncated: false,
    executeErrored: false,
  };
  const onStreamError = () =>
    "Failed to generate a response. Please try again.";
  const stream = createUIMessageStream<StudyUIMessage>({
    onError: onStreamError,
    execute: ({ writer }) =>
      executeTurn({
        state,
        writer,
        aiClient: { getModel: () => model } as never,
        modelId: "openai/gpt-oss-120b",
        primarySystemPrompt: PRIMARY_SYSTEM,
        fallbackSystemPrompt: FALLBACK_SYSTEM,
        modelMessages: [
          { role: "user", content: "what does unit of analysis mean" },
        ],
        tools: modelCanUseTools ? { ...retrievalTools, ...studyTools } : {},
        temperature: 0.7,
        maxOutputTokens: 2000,
        abortSignal: new AbortController().signal,
        chatbotId: "cb1",
        modelCanUseTools,
        useRetrievalTools: modelCanUseTools,
        ragResult: {
          contextText: "",
          sources: RAG_SOURCES,
          ragUsed: true,
          fileManifest: "",
          ragFailureNote: "",
          fileIds: ["f1"],
        },
        toolSources: [],
        onStreamError,
        startTime: Date.now(),
      }),
  });
  const chunks: Chunk[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  // The browser stops reading at the first error chunk, so the student sees
  // only what precedes it.
  const errorAt = chunks.findIndex((c) => c.type === "error");
  const seen = errorAt === -1 ? chunks : chunks.slice(0, errorAt);
  const shownText = seen
    .flatMap((c) => (c.type === "text-delta" ? [c.delta] : []))
    .join("");
  const finish = seen.find((c) => c.type === "finish");
  return {
    calls: model.doStreamCalls,
    shownText,
    sawError: errorAt !== -1,
    shownSources:
      finish?.type === "finish" ? finish.messageMetadata?.sources : undefined,
    state,
  };
}

type ModelCall = (typeof MockLanguageModelV3.prototype.doStreamCalls)[number];
const systemOf = (call: ModelCall | undefined) =>
  call?.prompt.find((m) => m.role === "system")?.content;
const toolNamesOf = (call: ModelCall | undefined) =>
  (call?.tools ?? []).map((t) => t.name);

/** streamText's default onError logs scripted failures to the console. */
const silenceStreamErrors = () =>
  jest.spyOn(console, "error").mockImplementation(() => {});

describe("a turn cut off mid-search", () => {
  it("makes the capped step answer, without the search tools", async () => {
    const answer = "The unit of analysis is who or what is being studied.";
    const r = await runTurn([
      ...SEARCHES_UNTIL_LAST_STEP,
      { text: answer, finish: "stop" },
    ]);

    expect(r.calls).toHaveLength(MAX_AGENT_STEPS);
    expect(toolNamesOf(r.calls[0])).toContain("search_documents");
    const last = r.calls[MAX_AGENT_STEPS - 1];
    expect(toolNamesOf(last)).toEqual(["showQuiz"]);
    expect(systemOf(last)).toContain(PRIMARY_SYSTEM);
    expect(systemOf(last)).toContain("last step");
    expect(r.shownText).toContain(answer);
    expect(r.shownSources).toEqual(RAG_SOURCES);
  });

  it("falls back to a no-tools answer when the capped step searches anyway", async () => {
    const r = await runTurn([
      ...SEARCHES_UNTIL_LAST_STEP,
      { search: "one more", finish: "tool-calls" },
      { text: FALLBACK_ANSWER, finish: "stop" },
    ]);

    expect(r.calls).toHaveLength(MAX_AGENT_STEPS + 1);
    const fallback = r.calls[MAX_AGENT_STEPS];
    expect(systemOf(fallback)).toBe(FALLBACK_SYSTEM);
    expect(toolNamesOf(fallback)).toEqual([]);
    expect(r.shownText).toContain(NARRATION);
    expect(r.shownText).toContain(FALLBACK_ANSWER);
    expect(r.sawError).toBe(false);
    expect(r.shownSources).toEqual(RAG_SOURCES);
  });

  it("falls back when the capped step searches but reports `stop`", async () => {
    // OpenRouter passes upstream finish reasons through; some report `stop`
    // beside a tool call.
    const r = await runTurn([
      ...SEARCHES_UNTIL_LAST_STEP,
      { search: "one more", finish: "stop" },
      { text: FALLBACK_ANSWER, finish: "stop" },
    ]);

    expect(r.calls).toHaveLength(MAX_AGENT_STEPS + 1);
    expect(r.shownText).toContain(FALLBACK_ANSWER);
  });

  it("answers through the fallback when the provider fails after the narration", async () => {
    silenceStreamErrors();
    const r = await runTurn([
      { text: NARRATION, search: "unit of analysis", finish: "tool-calls" },
      { providerFails: true },
      { text: FALLBACK_ANSWER, finish: "stop" },
    ]);

    expect(r.calls).toHaveLength(3);
    expect(systemOf(r.calls[2])).toBe(FALLBACK_SYSTEM);
    // No error chunk ahead of the answer, or the browser would never render it.
    expect(r.sawError).toBe(false);
    expect(r.shownText).toContain(FALLBACK_ANSWER);
    expect(r.shownSources).toEqual(RAG_SOURCES);
    expect(r.state.executeErrored).toBe(false);
  });

  it("answers through the fallback when the step reading the search fails before writing", async () => {
    silenceStreamErrors();
    const r = await runTurn([
      { text: NARRATION, search: "unit of analysis", finish: "tool-calls" },
      { errorChunk: true, finish: "error" },
      { text: FALLBACK_ANSWER, finish: "stop" },
    ]);

    expect(r.calls).toHaveLength(3);
    expect(r.sawError).toBe(false);
    expect(r.shownText).toContain(FALLBACK_ANSWER);
    expect(r.state.executeErrored).toBe(false);
  });
});

describe("a turn that answered", () => {
  it("does not append a fallback when the model answered and then stopped", async () => {
    const answer = "Ecological studies use groups as the unit of analysis.";
    const r = await runTurn([
      { text: answer, search: "unit of analysis", finish: "tool-calls" },
      { finish: "stop" },
    ]);

    expect(r.calls).toHaveLength(2);
    expect(r.shownText).toBe(answer);
    expect(r.sawError).toBe(false);
  });

  it("does not answer twice when the loop got past an error and answered", async () => {
    silenceStreamErrors();
    const answer = "The unit of analysis is the population.";
    const r = await runTurn([
      {
        text: NARRATION,
        errorChunk: true,
        search: "unit of analysis",
        finish: "tool-calls",
      },
      { text: answer, finish: "stop" },
    ]);

    expect(r.calls).toHaveLength(2);
    // The answer renders; the held error is still reported, after it.
    expect(r.shownText).toContain(answer);
    expect(r.shownText).not.toContain(FALLBACK_ANSWER);
    expect(r.sawError).toBe(true);
    expect(r.state.executeErrored).toBe(true);
  });

  it("keeps a partial answer and reports the failure rather than answering twice", async () => {
    silenceStreamErrors();
    const r = await runTurn([
      { text: "The unit of analysis is", errorChunk: true, finish: "error" },
      { text: FALLBACK_ANSWER, finish: "stop" },
    ]);

    expect(r.calls).toHaveLength(1);
    expect(r.shownText).toBe("The unit of analysis is");
    expect(r.sawError).toBe(true);
    expect(r.state.executeErrored).toBe(true);
  });

  it("does not answer again over an earlier answer when the capped step's quiz is unusable", async () => {
    const answer = "The unit of analysis is who or what is being studied.";
    const r = await runTurn([
      { text: answer, search: "unit of analysis", finish: "tool-calls" },
      ...SEARCHES_UNTIL_LAST_STEP.slice(1),
      {
        call: { name: "showQuiz", args: { quiz_title: "No questions" } },
        finish: "tool-calls",
      },
      { text: FALLBACK_ANSWER, finish: "stop" },
    ]);

    expect(r.calls).toHaveLength(MAX_AGENT_STEPS);
    expect(r.shownText).toContain(answer);
    expect(r.shownText).not.toContain(FALLBACK_ANSWER);
  });

  it("still reports a failure that no fallback can recover", async () => {
    silenceStreamErrors();
    const r = await runTurn(
      [{ text: "A partial answer", errorChunk: true, finish: "error" }],
      { modelCanUseTools: false },
    );

    expect(r.calls).toHaveLength(1);
    expect(r.sawError).toBe(true);
    expect(r.shownText).toBe("A partial answer");
    expect(r.state.executeErrored).toBe(true);
  });
});
