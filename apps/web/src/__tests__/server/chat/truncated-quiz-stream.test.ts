import { describe, it, expect } from "@jest/globals";
import { streamText, createUIMessageStream } from "ai";
import { MockLanguageModelV3, convertArrayToReadableStream } from "ai/test";
import { studyTools, type StudyUIMessage } from "@/server/chat/study-tools";
import { stripRetrievalOutputs } from "@/server/chat/stream-filter";
import { recoverLeakedQuiz } from "@/server/chat/recover-quiz";
import {
  repairQuizToolParts,
  closeTruncatedQuizInputs,
} from "@/server/chat/repair-quiz-parts";

const QUIZ = {
  quiz_title: "Shakespeare",
  questions: [1, 2, 3].map((i) => ({
    question: `Q${i}?`,
    options: ["A", "B", "C", "D"],
    correct_index: 1,
    explanation: `because ${i}`,
  })),
};

/** The quiz as the model would stream it, cut off inside the third question. */
const PARTIAL = JSON.stringify(QUIZ).slice(
  0,
  JSON.stringify(QUIZ).indexOf("Q3?") + 1,
);

/**
 * Replica of the `execute` wiring in `stream-chat.ts`: the same transform
 * pipeline, the same `onChunk` accumulation, and the same post-await writes,
 * with a mocked model whose quiz input is cut off mid-write.
 *
 * This covers the one seam the unit tests can't reach -- chunk ORDER. The
 * closing `tool-input-available` is written after `await primary.text`, while
 * the part's own `tool-input-start` / `tool-input-delta` chunks travel through
 * three transforms. With `writer.merge` those two paths run concurrently, and
 * the closing chunk was measured landing *before* the deltas it closes (at 60
 * deltas), which would leave the client re-opening the part as
 * `input-streaming` -- the eternal skeleton this feature exists to kill.
 * Draining the source (see `forward`) is what makes the order deterministic.
 */
async function runCutOffTurn(deltaCount: number) {
  const deltas: string[] = [];
  const size = Math.ceil(PARTIAL.length / deltaCount);
  for (let i = 0; i < PARTIAL.length; i += size) {
    deltas.push(PARTIAL.slice(i, i + size));
  }

  const stream = createUIMessageStream<StudyUIMessage>({
    onError: (error) => String(error),
    execute: async ({ writer }) => {
      const partialQuizInput = new Map<string, string>();
      const primary = streamText({
        model: new MockLanguageModelV3({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: "stream-start", warnings: [] },
              { type: "text-start", id: "t1" },
              { type: "text-delta", id: "t1", delta: "Here is your quiz." },
              { type: "text-end", id: "t1" },
              { type: "tool-input-start", id: "c1", toolName: "showQuiz" },
              ...deltas.map((delta) => ({
                type: "tool-input-delta",
                id: "c1",
                delta,
              })),
              {
                type: "finish",
                finishReason: "length",
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ] as never),
          }),
        }),
        tools: studyTools,
        prompt: "quiz me",
        onChunk({ chunk }) {
          if (
            chunk.type === "tool-input-start" &&
            chunk.toolName === "showQuiz"
          ) {
            partialQuizInput.set(chunk.id, "");
          } else if (chunk.type === "tool-input-delta") {
            const written = partialQuizInput.get(chunk.id);
            if (written !== undefined) {
              partialQuizInput.set(chunk.id, written + chunk.delta);
            }
          }
        },
      });

      // Drained, not merged -- see `forward` in stream-chat.ts. Merging here
      // reproduces the inversion this test exists to catch.
      const source = primary
        .toUIMessageStream<StudyUIMessage>({
          sendReasoning: false,
          sendFinish: false,
          onError: (error) => String(error),
        })
        .pipeThrough(stripRetrievalOutputs())
        .pipeThrough(repairQuizToolParts())
        .pipeThrough(recoverLeakedQuiz());
      const reader = source.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        writer.write(value);
      }

      const [, steps] = await Promise.all([primary.text, primary.steps]);
      const closing = closeTruncatedQuizInputs(
        partialQuizInput,
        steps.flatMap((s) => (s.toolCalls ?? []).map((t) => t.toolCallId)),
      );
      for (const chunk of closing) writer.write(chunk);
      writer.write({ type: "finish", finishReason: "length" } as never);
    },
  });

  const out: Array<Record<string, unknown>> = [];
  const outReader = stream.getReader();
  for (;;) {
    const { done, value } = await outReader.read();
    if (done) break;
    out.push(value as Record<string, unknown>);
  }
  return out;
}

describe("a quiz cut off at the token limit, end to end", () => {
  // A handful of delta counts: the risk is the closing write overtaking chunks
  // still sitting in transform buffers, and the tail is exactly where the cut
  // happens, so vary how much is in flight when generation stops.
  for (const deltaCount of [1, 3, 12, 60]) {
    it(`resolves the skeleton after its own chunks (${deltaCount} deltas)`, async () => {
      const out = await runCutOffTurn(deltaCount);
      const types = out.map((c) => c.type);

      const lastDelta = types.lastIndexOf("tool-input-delta");
      const available = types.indexOf("tool-input-available");
      const finish = types.lastIndexOf("finish");

      expect(lastDelta).toBeGreaterThanOrEqual(0);
      expect(available).toBeGreaterThan(lastDelta);
      expect(finish).toBeGreaterThan(available);

      // Nothing may follow that re-opens the part.
      expect(types.slice(available).includes("tool-input-start")).toBe(false);

      const part = out[available] as { toolCallId: string; input: unknown };
      expect(part.toolCallId).toBe("c1");
      expect((part.input as { questions: unknown[] }).questions).toHaveLength(
        2,
      );
    });
  }

  it("keeps the prose the model wrote before the quiz", async () => {
    const out = await runCutOffTurn(3);
    const text = out
      .filter((c) => c.type === "text-delta")
      .map((c) => c.delta)
      .join("");
    expect(text).toBe("Here is your quiz.");
  });
});
