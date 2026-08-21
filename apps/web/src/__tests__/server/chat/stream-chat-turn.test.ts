import { describe, it, expect } from "@jest/globals";
import {
  streamText,
  stepCountIs,
  hasToolCall,
  tool,
  createUIMessageStream,
  type InferUIMessageChunk,
} from "ai";
import { MockLanguageModelV3, convertArrayToReadableStream } from "ai/test";
import { z } from "zod";
import { studyTools, type StudyUIMessage } from "@/server/chat/study-tools";
import { stripRetrievalOutputs } from "@/server/chat/stream-filter";
import { repairQuizToolParts } from "@/server/chat/repair-quiz-parts";
import { recoverLeakedQuiz } from "@/server/chat/recover-quiz";
import { assistantMessageForDb } from "@/server/chat/ui-messages";
import { isRetrievalToolPart } from "@/lib/retrieval-tool-names";

type Chunk = InferUIMessageChunk<StudyUIMessage>;
type Step = {
  text?: string;
  call?: { name: string; args: unknown };
  finish: string;
};

/**
 * Replica of the decision logic in `streamChat`'s `execute` + `onFinish`, run
 * over the real AI SDK with a scripted multi-step model.
 *
 * The two gates it exercises look interchangeable and are not:
 *
 * - the `done`-answer gate must read the LAST step's text. `done` is a
 *   retrieval tool, so its part is stripped from the stream and from
 *   persistence; a model that narrates in step 1 and answers via `done` in
 *   step 2 loses its answer entirely if this gate spans the whole turn.
 * - `hasVisibleAnswer` must span EVERY step, or a turn that answered early and
 *   ended on a tool call looks empty and the fallback appends a second,
 *   independently generated answer.
 *
 * Getting either backwards produced a shipped bug, so both are pinned here.
 */
async function runTurn(script: Step[]) {
  let call = 0;
  let fallbackRan = false;

  const model = () =>
    new MockLanguageModelV3({
      doStream: async () => {
        const step = script[call] ?? { finish: "stop" };
        call++;
        const parts: unknown[] = [{ type: "stream-start", warnings: [] }];
        if (step.text) {
          parts.push({ type: "text-start", id: `t${call}` });
          parts.push({ type: "text-delta", id: `t${call}`, delta: step.text });
          parts.push({ type: "text-end", id: `t${call}` });
        }
        if (step.call) {
          parts.push({
            type: "tool-call",
            toolCallId: `c${call}`,
            toolName: step.call.name,
            input: JSON.stringify(step.call.args),
          });
        }
        parts.push({
          type: "finish",
          finishReason: step.finish,
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        });
        return { stream: convertArrayToReadableStream(parts as never) };
      },
    });

  const tools = {
    ...studyTools,
    search_documents: tool({
      description: "search",
      inputSchema: z.object({ query: z.string() }),
      execute: async () => "a passage about gender performativity",
    }),
    done: tool({
      description: "final answer",
      inputSchema: z.object({ answer: z.string() }),
    }),
  };

  const stream = createUIMessageStream<StudyUIMessage>({
    onError: (e) => String(e),
    execute: async ({ writer }) => {
      const primary = streamText({
        model: model(),
        prompt: "quiz me on the gender theory chapter",
        tools,
        stopWhen: [stepCountIs(5), hasToolCall("done")],
      });

      const source = primary
        .toUIMessageStream<StudyUIMessage>({
          sendReasoning: false,
          sendFinish: false,
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

      const [primaryText, steps] = await Promise.all([
        primary.text,
        primary.steps,
      ]);
      const stepsText = steps.map((s) => s.text ?? "").join("");
      const turnText = stepsText.trim() ? stepsText : primaryText;

      const calls = steps.flatMap((s) => s.toolCalls ?? []);
      const doneInput = calls.find((c) => c.toolName === "done")?.input as
        | { answer?: unknown }
        | undefined;
      const doneAnswer =
        typeof doneInput?.answer === "string" ? doneInput.answer : undefined;
      const producedQuiz = calls.some((c) => c.toolName === "showQuiz");

      // Gate 1: last-step text.
      if (doneAnswer && doneAnswer.trim() && !primaryText.trim()) {
        writer.write({ type: "text-start", id: "done" } as Chunk);
        writer.write({
          type: "text-delta",
          id: "done",
          delta: doneAnswer,
        } as Chunk);
        writer.write({ type: "text-end", id: "done" } as Chunk);
      }

      // Gate 2: whole-turn text.
      const hasVisibleAnswer =
        Boolean(turnText.trim()) || Boolean(doneAnswer?.trim()) || producedQuiz;
      if (!hasVisibleAnswer) {
        fallbackRan = true;
        writer.write({ type: "text-start", id: "fb" } as Chunk);
        writer.write({
          type: "text-delta",
          id: "fb",
          delta: "What topic are you interested in?",
        } as Chunk);
        writer.write({ type: "text-end", id: "fb" } as Chunk);
      }
    },
    onFinish: ({ responseMessage }) => {
      const kept = responseMessage.parts.filter(
        (p) => !isRetrievalToolPart(p.type),
      );
      persisted = assistantMessageForDb({ ...responseMessage, parts: kept });
    },
  });

  let persisted: { content: string; parts: StudyUIMessage["parts"] } = {
    content: "",
    parts: [],
  };
  const reader = stream.getReader();
  for (;;) {
    const { done } = await reader.read();
    if (done) break;
  }
  return { ...persisted, fallbackRan, modelCalls: call };
}

describe("streamChat turn semantics", () => {
  it("surfaces a done answer that follows an earlier narration step", async () => {
    const r = await runTurn([
      {
        text: "Let me check the readings.",
        call: { name: "search_documents", args: { query: "gender" } },
        finish: "tool-calls",
      },
      {
        call: {
          name: "done",
          args: { answer: "Butler argues gender precedes sex assignment." },
        },
        finish: "tool-calls",
      },
    ]);
    expect(r.content).toContain(
      "Butler argues gender precedes sex assignment.",
    );
    expect(r.fallbackRan).toBe(false);
  });

  it("does not append a fallback answer when an earlier step already answered", async () => {
    const r = await runTurn([
      {
        text: "Gender is performative, per Butler.",
        call: { name: "search_documents", args: { query: "gender" } },
        finish: "tool-calls",
      },
      { finish: "stop" },
    ]);
    expect(r.content).toContain("Gender is performative, per Butler.");
    expect(r.content).not.toContain("What topic are you interested in?");
    expect(r.fallbackRan).toBe(false);
  });

  it("still runs the fallback for a genuinely empty turn", async () => {
    const r = await runTurn([{ finish: "stop" }]);
    expect(r.fallbackRan).toBe(true);
  });

  it("renders a leaked quiz as a tool part and never as an answer key", async () => {
    const leak = `Here are 5 questions on the gender theory chapter.\n\n[showQuiz(quiz_title="Gender Theory and Barbie", questions=${JSON.stringify(
      [1, 2, 3, 4, 5, 6].map((i) => ({
        question: `Q${i}: what does Barbie stage about gender?`,
        options: ["A", "B", "C", "D"],
        answer: "B",
        explanation: `Because ${i}.`,
      })),
    )})]`;
    const r = await runTurn([{ text: leak, finish: "stop" }]);

    const quiz = r.parts.find((p) => p.type === "tool-showQuiz") as
      | { input: { questions: unknown[] } }
      | undefined;
    expect(quiz).toBeDefined();
    expect(quiz!.input.questions).toHaveLength(5); // trimmed to the ceiling
    expect(r.content).toContain("Here are 5 questions");
    expect(r.content).not.toContain("showQuiz(");
    expect(r.content).not.toContain("explanation");
    expect(r.fallbackRan).toBe(false);
  });
});
