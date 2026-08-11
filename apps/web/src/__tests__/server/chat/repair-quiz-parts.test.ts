import { describe, it, expect } from "@jest/globals";
import {
  repairQuizToolParts,
  closeTruncatedQuizInputs,
} from "@/server/chat/repair-quiz-parts";

type Chunk = Record<string, unknown>;

async function pump(chunks: Chunk[]): Promise<Chunk[]> {
  const stream = repairQuizToolParts();
  const writer = stream.writable.getWriter();
  const out: Chunk[] = [];
  const drained = (async () => {
    const reader = stream.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out.push(value as Chunk);
    }
  })();
  for (const chunk of chunks) await writer.write(chunk as never);
  await writer.close();
  await drained;
  return out;
}

const question = (i: number) => ({
  question: `Q${i}?`,
  options: ["A", "B", "C", "D"],
  correct_index: 1,
  explanation: `because ${i}`,
});

describe("repairQuizToolParts", () => {
  it("turns a truncated input error into a shorter quiz", async () => {
    const full = JSON.stringify({
      quiz_title: "Shakespeare",
      questions: [question(1), question(2), question(3)],
    });
    const out = await pump([
      {
        type: "tool-input-error",
        toolCallId: "c1",
        toolName: "showQuiz",
        input: full.slice(0, full.indexOf("Q3?") + 1),
        errorText: "JSON parsing failed",
      },
      { type: "tool-output-error", toolCallId: "c1", errorText: "boom" },
    ]);

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      type: "tool-input-available",
      toolCallId: "c1",
      toolName: "showQuiz",
    });
    const input = out[0]!.input as { questions: unknown[] };
    expect(input.questions).toHaveLength(2);
  });

  it("trims an over-long quiz that failed schema validation", async () => {
    const out = await pump([
      {
        type: "tool-input-error",
        toolCallId: "c1",
        toolName: "showQuiz",
        input: {
          quiz_title: "T",
          questions: [1, 2, 3, 4, 5, 6, 7].map(question),
        },
        errorText: "Type validation failed",
      },
      { type: "tool-output-error", toolCallId: "c1", errorText: "boom" },
    ]);
    expect(out).toHaveLength(1);
    expect((out[0]!.input as { questions: unknown[] }).questions).toHaveLength(
      5,
    );
  });

  it("repairs an accepted-but-unrenderable quiz in place", async () => {
    // Structurally valid, so it arrives as input-available, but the second
    // question's correct_index points past its options.
    const out = await pump([
      {
        type: "tool-input-available",
        toolCallId: "c1",
        toolName: "showQuiz",
        input: {
          quiz_title: "T",
          questions: [question(1), { ...question(2), correct_index: 9 }],
        },
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.type).toBe("tool-input-available");
    const input = out[0]!.input as { questions: Array<{ question: string }> };
    expect(input.questions.map((q) => q.question)).toEqual(["Q1?"]);
  });

  it("leaves a renderable quiz untouched", async () => {
    const input = [
      {
        type: "tool-input-available",
        toolCallId: "c1",
        toolName: "showQuiz",
        input: { quiz_title: "T", questions: [question(1)] },
      },
    ];
    expect(await pump(input)).toEqual(input);
  });

  it("leaves an unsalvageable error pair alone so the notice still shows", async () => {
    const input = [
      {
        type: "tool-input-error",
        toolCallId: "c1",
        toolName: "showQuiz",
        input: '{"quiz_ti',
        errorText: "JSON parsing failed",
      },
      { type: "tool-output-error", toolCallId: "c1", errorText: "boom" },
    ];
    expect(await pump(input)).toEqual(input);
  });

  it("does not touch other tools' chunks", async () => {
    const input = [
      {
        type: "tool-input-error",
        toolCallId: "s1",
        toolName: "search_documents",
        input: "{broken",
        errorText: "nope",
      },
      { type: "tool-output-error", toolCallId: "s1", errorText: "nope" },
      { type: "text-delta", id: "t1", delta: "hello" },
    ];
    expect(await pump(input)).toEqual(input);
  });

  it("keeps a nested brace inside a question when salvaging", async () => {
    const full = JSON.stringify({
      quiz_title: "Sets",
      questions: [
        {
          question: "Is {} the empty set?",
          options: ["Yes", "No"],
          correct_index: 0,
          explanation: "It is {}.",
        },
        { ...question(2), question: "cut off here" },
      ],
    });
    const out = await pump([
      {
        type: "tool-input-error",
        toolCallId: "c1",
        toolName: "showQuiz",
        input: full.slice(0, full.indexOf("cut off") + 4),
        errorText: "JSON parsing failed",
      },
    ]);
    const input = out[0]!.input as { questions: Array<{ question: string }> };
    expect(input.questions.map((q) => q.question)).toEqual([
      "Is {} the empty set?",
    ]);
  });

  it("only drops the output error of the call it repaired", async () => {
    const out = await pump([
      {
        type: "tool-input-error",
        toolCallId: "c1",
        toolName: "showQuiz",
        input: { quiz_title: "T", questions: [question(1), question(2)] },
        errorText: "boom",
      },
      { type: "tool-output-error", toolCallId: "other", errorText: "keep me" },
      { type: "tool-output-error", toolCallId: "c1", errorText: "drop me" },
    ]);
    expect(out.map((c) => c.type)).toEqual([
      "tool-input-available",
      "tool-output-error",
    ]);
    expect(out[1]).toMatchObject({ toolCallId: "other" });
  });
});

describe("closeTruncatedQuizInputs", () => {
  const full = JSON.stringify({
    quiz_title: "Shakespeare",
    questions: [question(1), question(2), question(3)],
  });

  it("resolves a cut-off input to the questions that finished", () => {
    const closing = closeTruncatedQuizInputs(
      new Map([["c1", full.slice(0, full.indexOf("Q3?") + 1)]]),
      [],
    );
    expect(closing).toHaveLength(1);
    expect(closing[0]).toMatchObject({
      type: "tool-input-available",
      toolCallId: "c1",
      toolName: "showQuiz",
    });
  });

  it("resolves an input with nothing salvageable to an error", () => {
    const closing = closeTruncatedQuizInputs(
      new Map([["c1", '{"quiz_ti']]),
      [],
    );
    expect(closing[0]).toMatchObject({
      type: "tool-output-error",
      toolCallId: "c1",
    });
  });

  it("ignores inputs that completed as real tool calls", () => {
    expect(closeTruncatedQuizInputs(new Map([["c1", full]]), ["c1"])).toEqual(
      [],
    );
  });

  /**
   * The invariant that matters: a part left in `input-streaming` renders as a
   * skeleton that spins for the rest of the session, so every started input must
   * come back either resolved or errored, never nothing.
   */
  it("never leaves a started input unresolved", () => {
    const partials = new Map([
      ["done", full],
      ["salvageable", full.slice(0, full.indexOf("Q2?") + 1)],
      ["hopeless", "{"],
      ["empty", ""],
    ]);
    const closing = closeTruncatedQuizInputs(partials, ["done"]);
    expect(closing.map((c) => c.toolCallId).sort()).toEqual([
      "empty",
      "hopeless",
      "salvageable",
    ]);
    expect(closing.every((c) => c.type !== undefined)).toBe(true);
  });
});
