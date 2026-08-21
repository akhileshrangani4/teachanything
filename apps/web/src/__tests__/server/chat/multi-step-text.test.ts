import { describe, it, expect } from "@jest/globals";
import { streamText, stepCountIs, tool } from "ai";
import { MockLanguageModelV3, convertArrayToReadableStream } from "ai/test";
import { z } from "zod";

/**
 * Pins the AI SDK semantics that `streamChat`'s empty-response fallback depends
 * on: `result.text` is the LAST step's text, not the turn's.
 *
 * `streamChat` runs a multi-step turn (`stopWhen: [stepCountIs(5),
 * hasToolCall("done")]`), so a model that answers in an earlier step and then
 * calls a retrieval tool ends on an empty step. Reading `result.text` there
 * reports no visible answer, which fired the fallback and appended a second,
 * independently generated answer to a turn the student had already seen
 * answered -- the "history shows a different reply than the live one" bug.
 *
 * If a future SDK release makes `result.text` span the whole turn, this test
 * fails and the `stepsText` accumulation in stream-chat.ts can be simplified.
 */
describe("multi-step turn text", () => {
  const twoStepModel = () => {
    let call = 0;
    return new MockLanguageModelV3({
      doStream: async () => {
        call++;
        return call === 1
          ? {
              stream: convertArrayToReadableStream([
                { type: "stream-start", warnings: [] },
                { type: "text-start", id: "t1" },
                {
                  type: "text-delta",
                  id: "t1",
                  delta: "Butler argues gender precedes sex assignment.",
                },
                { type: "text-end", id: "t1" },
                {
                  type: "tool-call",
                  toolCallId: "c1",
                  toolName: "search_documents",
                  input: "{}",
                },
                {
                  type: "finish",
                  finishReason: "tool-calls",
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ] as never),
            }
          : {
              stream: convertArrayToReadableStream([
                { type: "stream-start", warnings: [] },
                {
                  type: "finish",
                  finishReason: "stop",
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ] as never),
            };
      },
    });
  };

  const runTurn = async () => {
    const result = streamText({
      model: twoStepModel(),
      tools: {
        search_documents: tool({
          description: "search",
          inputSchema: z.object({}),
          execute: async () => "a passage",
        }),
      },
      stopWhen: [stepCountIs(5)],
      prompt: "quiz me on the gender theory chapter",
    });
    for await (const chunk of result.textStream) void chunk;
    const [text, steps] = await Promise.all([result.text, result.steps]);
    return { text, steps };
  };

  it("reports no text from the final step even though the turn answered", async () => {
    const { text, steps } = await runTurn();
    expect(steps).toHaveLength(2);
    expect(text).toBe("");
  });

  it("finds the answer when text is accumulated across every step", async () => {
    const { text, steps } = await runTurn();
    // How stream-chat.ts derives `turnText`.
    const stepsText = steps.map((step) => step.text ?? "").join("");
    const turnText = stepsText.trim() ? stepsText : text;

    expect(turnText).toContain("Butler argues gender precedes sex assignment.");
    // The gate that decides whether the fallback turn runs.
    expect(Boolean(turnText.trim())).toBe(true);
  });
});
